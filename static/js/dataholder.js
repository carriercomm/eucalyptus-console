define([
  'underscore',
  'backbone',
  'sharedtags',
  'autoscalingtags',
  'models/scalinggrps',
  'models/scalinginsts',
  'models/scalingpolicys',
  'models/volumes',
  'models/images',
  'models/allimages',
  'models/amazonimages',
  'models/launchconfigs',
  'models/instances',
  'models/addresses',
  'models/keypairs',
  'models/sgroups',
  'models/snapshots',
  'models/balancers',
  'models/insthealths',
  'models/summarys',
  'models/alarms',
  'models/metrics',
  'models/availabilityzones',
  'models/loadbalancers',
  'models/regions'
], 
function(_, Backbone, tags, astags) {
  var self = this;
  var sconfs = [
    ['scalinggrps'],
    ['scalinginsts'],
    ['scalingpolicys'],
    ['volumes'],
    ['images'],
    ['allimages'],
    ['amazonimages'],
    ['launchconfigs'],
    ['instances'],
    ['addresses'],
    ['keypairs'],
    ['sgroups'],
    ['snapshots'],
    ['loadbalancers'],
    ['insthealths'],
    ['summarys'],
    ['alarms'],
    ['metrics'],
    ['availabilityzones'],
    ['loadbalancers'],
    ['regions']
  ];

  var shared = {};
  var args = arguments;
  var srcs = _.map(_.range(4, args.length), function(n) { 
    return args[n]; 
  });

  _.each(srcs, function(src, index) {
     var clz = srcs[index];
     var obj = new clz();
     _.each(sconfs[index], function(name) {
       shared[name] = obj;
     });
  });

  shared.tags = tags;
  shared.tag = tags;
  shared.astags = astags;

  shared.allimages.on('reset add remove change sync', function() {
    shared.allimages.add(shared.images.models, {merge:true});
  });
  shared.images.on('reset add remove change sync', function() {
    shared.allimages.add(shared.images.models, {merge:true});
  });
	return shared;
});
