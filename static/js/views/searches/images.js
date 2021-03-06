define([
  'views/searches/generic',
  'views/searches/tagsearch',
  'app'
], function(Search, TagSearch, app) {
  return function(images) {

    var USER_ID = "";
    app.data.sgroups.on('add sync reset', function(groups) {
      grps = app.data.sgroups.where({name:'default'});
      if (grps.length == 1) {
        USER_ID = grps[0].get('owner_id');
      }
    });
    var config = {
      field: 'image',
      facets: ['all_text', 'architecture', 'description', 'name',
        'ownerId', 'platform', 'root_device_type'],

      localize: {
        ownerId: app.msg('search_facet_image_owner'), //'Owner',
        i386 : app.msg('search_facet_image_i386'), //'32-bit',
        x86_64 : app.msg('search_facet_image_x86_64'), //'64-bit',
        root_device_type : app.msg('search_facet_image_root_device'), //'Root Device',
        ebs : app.msg('search_facet_image_ebs'), //'EBS',
        platform: app.msg('search_facet_image_platform'), //'Platform'
        architecture: app.msg('search_facet_image_arch'), //'Architecture'
        description: app.msg('search_facet_image_desc'), //'Description'
        name: app.msg('search_facet_image_name'),
        all_text: app.msg('search_facet_alltext')
      },

      match: {
        ownerId: function(search, item, add) {
          add('me');
          if (app.aws && app.aws.aws_account) {
            add('amazon');
          }
        }
      },

      custom_source: function(search, facets) {
        if (facets && facets.find && facets.find('ownerId') == 'me') {
          console.log("IMAGE SEARCH : using app.data.images");
          if (app.data.images.length < 1) {
            app.data.images.reset([]);
            app.data.images.fetch();
          }
          return app.data.images;
        }
        else if (facets && facets.find && facets.find('ownerId') == 'amazon') {
          console.log("IMAGE SEARCH : using app.data.amazonimages");
          if (app.data.amazonimages.length <= app.data.images.length) {
            app.data.amazonimages.reset([]);
            app.data.amazonimages.fetch();
          }
          return app.data.amazonimages;
        }
        else {
          console.log("IMAGE SEARCH : using app.data.allimages");
          //app.data.allimages.add(app.data.images);
          if (app.aws && app.aws.aws_account) {
            notifySuccess($.i18n.prop('images_aws_no_owner_msg'));
          }
          if (app.data.allimages.length <= app.data.images.length || app.data.allimages.length <= app.data.amazonimages.length) {
            app.data.images.reset([]);
            app.data.allimages.reset([]);
            app.data.allimages.fetch();
          }
          return app.data.allimages;
        }
      },

      search: {
        ownerId: function(search, facetSearch, item, itemsFacetValue, hit) {
          var test = facetSearch === 'me' ? USER_ID : facetSearch;
          if (item.get('owner_alias') === test || item.get('owner_id') === test) {
            hit();
          }
        }
      }
    };

    if (app.aws && app.aws.aws_account) {
        config.defaultSearch = 'ownerId: amazon';        
    }

    var searchConfig = new Search(images, new TagSearch(config, images));
    return searchConfig;
  }
});
