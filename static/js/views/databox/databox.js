
define(['app', 'backbone'], function(app, Backbone) {
    return function(records){

      var databox = {

        columnMap: [
                  {name:'instance', column:[{id:'2', value:'display_id'}, {id:'12', value:'state'}, {id:'4', value:'image_id'}, {id:'5', value:'placement'}, {id:'6', value:'public_dns_name'}, {id:'7', value:'private_dns_name'}, {id:'8', value:'key_name'}, {id:'9', value:'group_name'}, {id:'11', value:'root_device_name'}, {id:'13', value:'launch_time'},{id:'16', value:'ip_address'}, {id:'17', value:'id'}, {id:'18', value:'display_id'} ]},
                  {name:'image', column:[{id:'1', value:'display_id'}, {id:'2', value:'name'}, {id:'3', value:'id'}, {id:'4', value:'architecture'}, {id:'5', value:'description'}, {id:'6', value:'root_device_type'}, {id:'10', value:'id'}]},
                  {name:'volume', column:[{id:'1', value:'display_id'}, {id:'8', value:'status'}, {id:'3', value:'size'}, {id:'4', value:'display_instance_id'}, {id:'5', value:'display_snapshot_id'}, {id:'6', value:'zone'}, {id:'9', value:'create_time'}, {id:'10', value:'id'}]},
                  {name:'snapshot', column:[{id:'1', value:'display_id'}, {id:'7', value:'status'}, {id:'3', value:'volume_size'}, {id:'4', value:'display_volume_id'}, {id:'9', value:'description'}, {id:'8', value:'start_time'}, {id:'10', value:'id'}]}
,
                  {name:'eip', column:[{id:'1', value:'public_ip'}, {id:'3', value:'instance_id'}, {id:'4', value:'public_ip'}, {id:'2', value:'instance_id'}]},
                  {name:'keypair', column:[{id:'3', value:'name'}]},
                  {name:'sgroup', column: [{id:'1', value:'name'}, {id:'2', value:'description'}, {id:'6', value:'description'}, {id:'7', value:'name'}]},
        ],

        sortData: function(){
          records.sort();
        },

        sortDataReverse: function(){
          // ISSUE: THIS CAUSES THE RECORDS COLLECTION TO BE DETACHED FROM THE ORIGINAL - KYO080713
          records = new Backbone.Collection(records.sort().toJSON().reverse());
        },

        setComparator: function(comparator){
          records.comparator = comparator;
        },

	sortDataForDataTable: function(page, column_id, order){
	  var self = this;
	  var sortValue = "";

	  console.log("Sort Page: " + page);
	  $.each(this.columnMap, function(idx, map){
            if(map.name === page){
              $.each(map.column, function(index, col){
	        if(col.id == column_id){
		  sortValue = col.value;       
		}
	      });
            }
          });
 
	  console.log("SortValue: " + sortValue);
	  this.setComparator(function(item) {
            return item.get(sortValue) ? item.get(sortValue) : "";
          });

	  console.log("Sorting Order: " + order);
	  if( order === "asc" ){
	    this.sortData();
	  }else{
	    this.sortDataReverse();
	  }
	},

        getCollection: function(){
          return records;
        },

        getCollectionBySlice: function(start, end){
          return new Backbone.Collection(records.toJSON().slice(start, end));
        },

        getArray: function(){
          return records.toJSON();
        },

        getArrayBySlice: function(start, end){
          return records.toJSON().slice(start, end);
        },

	getTotalLength: function(){
	  return records.toJSON().length;
	},

      };

      return databox;

    };
});
