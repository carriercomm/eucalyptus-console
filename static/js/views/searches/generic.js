define(['app', 'backbone'], function(app, Backbone) {
  var self = this;
  var SEARCH_WORKER_INTERVAL = 100; // Worker processing interval, in milliseconds
  var RESULT_UPDATE_INTERVAL = 1500; // Interval for updating user results

  function isArray(o) {
    return o && typeof o === 'object' && typeof o.forEach === 'function' && typeof o.length === 'number';
  }
  
  return function(records, config /*, allowedFacetNames, localizer, explicitFacets, searchers, propertyMapping*/) {
    var self = this;
    //searchContext = self;
    
    if (isArray(config)) {
      var nue = {
        facets : config
      };
      config = nue;
    }
    
    // Make sure if the argument isn't there, that at least
    // something works
    if (!config.facets) {
      config.facets = [];
      var done = {};
      records.forEach(function(img) {
        for (var key in img) {
          if (!isIgnored(key, img, done)) {
            config.facets.push(key);
            done[key] = true;
          }
        }
      });
    }
    
    var sortKeyList = function(list, keyName) {
      return _.chain(list)
              .sortBy(function(obj){ return obj.keyName; })
              .uniq()
              .value();
    };

    function localize(name) {
      var result = name;
      if (config.localize) {
        if (typeof config.localize === 'function') {
          var localized = config.localize(name);
          if (localized) {
            return localized;
          }
        } else if (config.localize[name]) {
          return config.localize[name];
        }
      }
      function capitalize(words) {
        for (var i = 0; i < words.length; i++) {
          words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
        }
        return words;
      }
      result = capitalize(name.split(/_/g)).join(' ');
      result = capitalize(result.split(/-/g)).join(' ');
      result = capitalize(result.split(/\./g)).join(' ');
      result = result.replace(/&#x2f;/g, '/');
      result = result.replace(/&#.{0,3};/g, '');
      return result;
    }

    var siftKeyList = function(list, search) {
      // first: filter items that match the regex
      return _.chain(list).filter(function(item) {
        return RegExp('.*' + search + '.*', 'i').test(item.value);
      // next: map 'None' values to empty string, or keep the original
      }).map(function(item) {
        return item === '' ? {value: item, label: 'None'} : item;
      }).value();
    };

    function isIgnored(key, on, done) {
      return (/^_.*/).test(key) || typeof on[key] === 'function' || done[key];
    }
    
    var searchOptions = {
      preserveOrder : true
    };

    // finds facet names from the data
    function deriveFacets() {
      var derivedFacets = [];
      config.facets.forEach(function(facet) {
        derivedFacets.push({label: localize(facet), value: facet});
      });
      var appended = [];
      if (typeof config.facetsCustomizer === 'function') {
        var add = function(property, label) {
          derivedFacets.push({value: property, label: label ? label : localize(property)});
        };
        var append = function(property, label, category) {
          var atts = {
            value: property, 
            label: label ? label : localize(property)
          };
          if (category) { atts.category = category; }
          appended.push(atts);
        };
        config.facetsCustomizer.apply(self, [add, append]);
      }
      var result = derivedFacets;
      derivedFacets.sort(function(a, b) {
        return a.label > b.label ? 1 : a.label < b.label ? -1 : 0;
      });
      appended.forEach(function(additional) {
        result.push(additional);
      });
      return _.uniq(result);
    }
    self.deriveFacets = deriveFacets;

    function findMatches(facet, searchTerm, img, add) {
        if (config.match && typeof config.match[facet] === 'function') {
          var doneMatching = config.match[facet].apply(self, [searchTerm, img, add]);
          if (doneMatching) {
            return;
          }
        }
        var val = img.get(facet);
        if (val && typeof val !== 'object' && typeof val !== 'function') {
            add(val);
        } else if (isArray(val)) {
            val.forEach(function(item) {
              add(item, localize(item + ''));
            });
        } else if (typeof val === 'object') {
          if (config.propertyForFacet && config.propertyForFacet[facet]) {
              var nm = val[config.propertyForFacet[facet]];
              if (nm) { // avoid null
                add(val + '', localize(nm));
              }
          }
        } else if (val === undefined && facet.indexOf('_tag') !== -1) {
            var sfacet = facet.replace(' _tag','');
            img.get('tags').each(function(t) { 
                if (t.get('name') == sfacet) add(t.get('value')); 
            });
        }
    }

    // looks for matches based on the facet selection
    function deriveMatches(facet, searchTerm) {
      var result = [];
      var found = [];
      records.each(function(record) {
        if(!record.get('tags')) { return; }
        findMatches(facet, searchTerm, record, function(val, label){
          if (found.indexOf(val) < 0) {
            found.push(val);
            result.push({name : facet, value : val, label : label ? label : localize(val) });
          }
        });
      });
      result = sortKeyList(result, 'label');
      return siftKeyList(result, searchTerm);
    }

    var MAX_RECURSE = 5;
    function drillThrough(obj, rex, depth) {
      if (MAX_RECURSE === depth) {
        return false;
      }
      var result = false;
      switch (typeof obj) {
        case 'string' :
          result = rex.test(obj);
          break;
        case 'number' :
          result = rex.test('' + obj);
          break;
        case 'object' :
          if (obj instanceof Backbone.Model) {
            if (obj.searchable) {
                for (var key in obj.searchable) {
                  result = rex.test(obj.attributes[obj.searchable[key]]);
                  if (result) {
                    break;
                  }
                }
            } else {
                for (var key in obj.attributes) {
                  result = drillThrough(obj.attributes[key], rex, depth + 1);
                  if (result) {
                    break;
                  }
                }
            }
          } else if (obj instanceof Backbone.Collection) {
            for (var i = 0; i < obj.length; i++) {
              result = drillThrough(obj.at(i), rex, depth + 1);
              if (result) {
                break;
              }
            }
          } else if (isArray(obj)) {
            for (var i = 0; i < obj.length; i++) {
              result = drillThrough(obj[i], rex, depth + 1);
              if (result) {
                break;
              }
            }
          } else {
            for (var key in obj) {
              result = drillThrough(obj[key], rex, depth + 1);
              if (result) {
                break;
              }
            }
          }
      }
      return result;
    }
    
    self.records = records;
    this.filtered = records.clone();
    this.lastSearch = '';
    this.lastFacets = [];

    self.searching = false;
    // the actual search function
    this.search = function(search, facets) {
         //console.log('SEARCH', self.searching, config, self.records);
        if (self.searching) return;
        self.searching = true;

        if (config.custom_source) {
          var newrecords = config.custom_source(search, facets);
          records.trigger('deprecated', newrecords); 
          self.records = null;
          records = null;
          records = self.records = newrecords;
        }

        if (self.records != null && self.filtered != null) self.filtered.stopListening(self.records);
        // console.log('CUSTOM SOURCE', self.records);
        self.filtered.listenTo(self.records, 'sync reset add remove destroy', _.debounce(function() {
          if (self.records == null) return;
          if ( self.records.length > 0 || self.filtered.length > 0 ) {
            up();
          }
          else {
              self.records.needsFetching = true;
          }
        }, 1000), this);

        self.filtered.listenTo(self.records, 'change', _.debounce(function(model) {
            if (model.changed.clicked == undefined && model.changed.expanded == undefined) {
                up();
            }
        }, 1000), this);

        self.lastSearch = search;
        self.lastFacets = facets;
        config.search.tags = undefined;

        var processed = 0;
        var updateResults = _.throttle(function() {
            // console.log('UPDATE', self.workRecords.length);
            self.filtered.reset(self.workResults.models);
        }, RESULT_UPDATE_INTERVAL);

        // Allow an existing search work set to be reset but do not allow workers to double up.
        
        var lastTime = new Date().getTime();
        var asyncSearch = this.asyncSearch = function() {
             processed = 0;
             var currentTime = new Date().getTime();
             while (currentTime - lastTime < SEARCH_WORKER_INTERVAL && self.workRecords.length > 0) {
              currentTime = new Date().getTime();
              var model = self.workRecords.pop();
              // test each facet (and pass values that match every facet)
              var testAll = facets.every(function(facet) {
                var category = facet.get('category');
                var value = facet.get('value');
                var curr = model.get(category);
                // If the test is on the tags model, convert it to JSON.
                if (category.indexOf('_tag') !== -1) { curr = model.get('tags'); }

                // If there is a customer search configured for this facet, run it.
                if (config.search && config.search[category]) {
                  var isMatch = false;
                  function hit() {
                    isMatch = true;
                  }
                  // assemble search string that reflects this facet only
                  var thisSearch = "\""+category+"\": \""+value+"\"";
                  var doneSearching = config.search[category].apply(self, [thisSearch, value, model, curr, hit]);
                  if (doneSearching || isMatch) {
                    //console.log("model("+model.get('id')+") facet "+value+" matches "+isMatch);
                    return isMatch;
                  }
                }

                // Otherwise try recursive RegExp search
                var rex = new RegExp('.*' + value + '.*', 'img');

                var isMatch = false;
                if (curr) { // facet search
                  isMatch = drillThrough(curr, rex, 0);
                } else { // text search
                  isMatch = drillThrough(model, rex, 0);
                }
                //console.log("model("+model.get('id')+") facet "+value+" matches "+isMatch);
                return isMatch;
              });

              processed++;

              if (testAll) {
                  self.workResults.add(model);
              }
          }

//          console.log('PROCESSED:' + processed + ' in ' + (currentTime - lastTime) + ' milliseconds ('+currentTime +'-'+ lastTime +')');
//         console.log('WORKRECORDS: ' + self.workRecords.length, self.workRecords);

          lastTime = currentTime;

          if (self.workRecords.length > 0) {
            _.defer(asyncSearch);
          } else {
            self.searching = false;
          }

          updateResults();
      }
      
      // for each record
      // console.log('ASYNC SEARCH: start', self.records);
      self.workRecords = self.records.clone();
      self.workResults = new Backbone.Collection();

      asyncSearch();
    }

    this.facetMatches = function(callback) {
      callback(self.facetSet, searchOptions);
    };
    
    this.valueMatches = function(facet, searchTerm, callback) {
      callback(deriveMatches(facet, searchTerm), searchOptions)
    };

    this.save = function() {
        //console.log('Clicked save', self.vsearch.searchBox.value());
        if (config.field) {
            var savedSearches = {};
            var cookie = $.cookie('__EUCA_SAVED_SEARCH__');
            if (cookie !== undefined && cookie != null) {
                savedSearches = JSON.parse(cookie);
            }

            if (savedSearches[config.field] == self.vsearch.searchBox.value()) {
                savedSearches[config.field] = undefined;
                notifySuccess(null, $.i18n.prop('search_clear_success', config.field));
                self.saveStatus.set('display', 'icon_star');
                self.saveStatus.set('tooltip', $.i18n.prop('search_save_tooltip'));
            } else {
                savedSearches[config.field] = self.vsearch.searchBox.value();
                notifySuccess(null, $.i18n.prop('search_save_success', config.field));
                self.saveStatus.set('display', 'icon_star_saved');
                self.saveStatus.set('tooltip', $.i18n.prop('search_clear_tooltip'));
            }
            $.cookie('__EUCA_SAVED_SEARCH__', JSON.stringify(savedSearches));
        }
    };

    this.saveStatus = new Backbone.Model({
        display: 'icon_star',
        tooltip: $.i18n.prop('search_save_tooltip')
    });

    this.updateStar = function() {
        if (config.field) {
            var savedSearches = {};
            if ($.cookie('__EUCA_SAVED_SEARCH__') != undefined) {
                savedSearches = JSON.parse($.cookie('__EUCA_SAVED_SEARCH__'));
            }

            if (self.vsearch && self.vsearch.searchBox && savedSearches[config.field] == self.vsearch.searchBox.value()) {
                self.saveStatus.set('display', 'icon_star_saved');
                self.saveStatus.set('tooltip', $.i18n.prop('search_clear_tooltip'));
            } else {
                self.saveStatus.set('display', 'icon_star');
                self.saveStatus.set('tooltip', $.i18n.prop('search_save_tooltip'));
            }
        }
    };

    function up() {
       //console.log('UP() CALL');
      self.search(self.lastSearch, self.lastFacets);
    }

    var defaultSearch = config.defaultSearch !== undefined ? config.defaultSearch : '';
    if ($.cookie('__EUCA_SAVED_SEARCH__') && config.field !== undefined) {
        var savedSearches = JSON.parse($.cookie('__EUCA_SAVED_SEARCH__'));
        if (savedSearches[config.field] !== undefined) {
            defaultSearch = savedSearches[config.field];
        } 
    }
    self.defaultSearch = defaultSearch;
    
    self.facetSet = deriveFacets();
    self.filtered.listenTo(records, 'sync reset add remove destroy change', _.debounce(function() {
      self.facetSet = deriveFacets();
    }, 500));
    self.filtered.listenTo(app.data.tags, 'sync reset add remove destroy change', _.debounce(function() {
      self.facetSet = deriveFacets();
    }, 500));
    //self.filtered.listenTo(records, 'sync reset add remove destroy change', up);
    
    this.close = function() {
      self.filtered.stopListening(records);
      self.filtered.stopListening(self.records);
      self.filtered.stopListening(app.data.tags);
      self.saveStatus = null;
      self.workRecords = null;
      self.workResults = null;
      self.filtered = null;
      self.newrecords = null;
      self.records = null;
      self.vsearch = null;
    };
  };
});
