SimpleStore = {}

/**
 Ember-REST.js 0.1.1

 A simple library for RESTful resources in Ember.js

 Copyright (c) 2012 Cerebris Corporation

 Licensed under the MIT license:
   http://www.opensource.org/licenses/mit-license.php
*/

/**
  An adapter for performing resource requests

  The default implementation is a thin wrapper around jQuery.ajax(). It is mixed in to both SimpleStore.Model
  and SimpleStore.Collection.

  To override SimpleStore.ModelAdapter entirely, define your own version and include it before this module.

  To override a portion of this adapter, reopen it directly or reopen a particular SimpleStore.Model or
  SimpleStore.Collection. You can override `_resourceRequest()` entirely, or just provide an implementation of
  `_prepareResourceRequest(params)` to adjust request params before `jQuery.ajax(params)`.
*/
if (SimpleStore.ModelAdapter === undefined) {
  SimpleStore.ModelAdapter = Ember.Mixin.create({
    /**
      @private

      Performs an XHR request with `jQuery.ajax()`. Calls `_prepareResourceRequest(params)` if defined.
    */
    _resourceRequest: function(params) {
      params.url = this._url();
      params.dataType = 'json';

      if (this._prepareResourceRequest !== undefined) {
        this._prepareResourceRequest(params);
      }

      return jQuery.ajax(params);
    }
  });
}

/**
  A model class for RESTful resources

  Extend this class and define the following properties:

  * `resourceIdField` -- the id field for this resource ('id' by default)
  * `url` -- the base url of the resource (e.g. '/contacts');
       will append '/' + id for individual resources (required)
  * `resourceName` -- the name used to contain the serialized data in this
       object's JSON representation (required only for serialization)
  * `resourceProperties` -- an array of property names to be returned in this
       object's JSON representation (required only for serialization)

  Because `resourceName` and `resourceProperties` are only used for
    serialization, they aren't required for read-only resources.

  You may also wish to override / define the following methods:

  * `serialize()`
  * `serializeProperty(prop)`
  * `deserialize(json)`
  * `deserializeProperty(prop, value)`
  * `validate()`
*/
SimpleStore.Model = Ember.Object.extend(SimpleStore.ModelAdapter, Ember.Copyable, {
  resourceIdField:  'id',
  url:              Ember.required(),
  store:            Ember.required(),
  collection:       Ember.required(),

  /**
    Duplicate properties from another resource

    * `source` -- an SimpleStore.Model object
    * `props` -- the array of properties to be duplicated;
         defaults to `resourceProperties`
  */
  duplicateProperties: function(source, props) {
    var prop;

    if (props === undefined) props = this.resourceProperties;

    for(var i = 0; i < props.length; i++) {
      prop = props[i];
      this.set(prop, source.get(prop));
    }
  },

  /**
    Create a copy of this resource

    Needed to implement Ember.Copyable

    REQUIRED: `resourceProperties`
  */
  copy: function(deep) {
    var c = this.constructor.create();
    c.duplicateProperties(this);
    c.set(this.resourceIdField, this.get(this.resourceIdField));
    return c;
  },

  /**
    Generate this resource's JSON representation

    Override this or `serializeProperty` to provide custom serialization

    REQUIRED: `resourceProperties` and `resourceName` (see note above)
  */
  serialize: function() {
    var name = this.resourceName,
        props = this.resourceProperties,
        prop,
        ret = {};

    ret[name] = {};
    for(var i = 0; i < props.length; i++) {
      prop = props[i];
      ret[name][prop] = this.serializeProperty(prop);
    }
    return ret;
  },

  /**
    Generate an individual property's JSON representation

    Override to provide custom serialization
  */
  serializeProperty: function(prop) {
    return this.get(prop);
  },

  /**
    Set this resource's properties from JSON

    Override this or `deserializeProperty` to provide custom deserialization
  */
  deserialize: function(json) {
    Ember.beginPropertyChanges(this);
    for(var prop in json) {
      if (json.hasOwnProperty(prop)) this.deserializeProperty(prop, json[prop]);
    }
    Ember.endPropertyChanges(this);
    return this;
  },

  /**
    Set an individual property from its value in JSON

    Override to provide custom serialization
  */
  deserializeProperty: function(prop, value) {
    this.set(prop, value);
  },

  /**
    Create (if new) or update (if existing) record

    Will call validate() if defined for this record

    If successful, updates this record's id and other properties
    by calling `deserialize()` with the data returned.

    REQUIRED: `properties` and `name` (see note above)
  */
  saveResource: function() {
    var self = this;

    if (this.validate !== undefined) {
      var error = this.validate();
      if (error) {
        return {
          fail: function(f) { f(error); return this; },
          done: function() { return this; },
          always: function(f) { f(); return this; }
        };
      }
    }



    return this._resourceRequest({type: this.isNew() ? 'POST' : 'PUT',
                                  data: this.serialize()})
      .done(function(json) {
        // Update properties
        if (json) self.deserialize(json);
      });
  },

  /**
    Delete resource
  */
  destroyResource: function() {
    return this._resourceRequest({type: 'DELETE'});
  },

  /**
   Is this a new resource?
  */
  isNew: function() {
    return (this._resourceId() === undefined);
  },

  /**
    @private

    The URL for this resource, based on `url` and `_resourceId()` (which will be
      undefined for new resources).
  */
  _url: function() {
    var url = this.url,
        id = this._resourceId();

    if (id !== undefined)
      url += '/' + id;

    return url;
  },

  /**
    @private

    The id for this resource.
  */
  _resourceId: function() {
    return this.get(this.resourceIdField);
  }
});

SimpleStore.Model.reopenClass({
  find: function(){console.log(this)}
})

/**
  A controller for RESTful resources

  Extend this class and define the following:

  * `model` -- an SimpleStore.Model class; the class must have a `serialize()` method
       that returns a JSON representation of the object
  * `url` -- (optional) the base url of the resource (e.g. '/contacts/active');
       will default to the `url` for `model`
*/
SimpleStore.Store = Ember.Object.extend({

});

SimpleStore.Collection = Ember.ArrayProxy.extend(SimpleStore.ModelAdapter, {
  model: Ember.required(),

  /**
    @private
  */
  init: function() {
    this._super();
    this.clearAll();
    this.index = Ember.A();
  },

  /**
    Create and load a single `SimpleStore.Model` from JSON
  */
  load: function(json) {
    var record = this.findByIdInStore(json.id)
    if (Ember.none(record)) {
      var record = this.get('model').create().deserialize(json);
      this.pushObject(record);
      this.index.push(record[record.resourceIdField])
    } else {
      record.deserialize(json)
    }
  },

  findById: function(id){
    var record = this.findByIdInStore(id)
    if ( Ember.none(record) ){
      record = this.findFromServer(id)
    }
    return record
  },

  findByIdInStore: function(id){
    var index = this.get('index').indexOf(id)
    return this.get('content')[index]
  },

  findFromServer: function(id){
    var self = this;

    var record = this.model.create({id: id, state: 'finding'})

    this._resourceRequest({type: 'GET'})
    .done(function(json) {
      record.deserialize(json);
      record.set('state', 'loaded')
    });

    return record
  },

  /**
    Create and load `SimpleStore.Model` objects from a JSON array
  */
  loadAll: function(json) {
    for (var i=0; i < json.length; i++)
      this.load(json[i]);
  },

  /**
    Clear this controller's contents (without deleting remote resources)
  */
  clearAll: function() {
    this.set("content", []);
    this.set("index", [])
  },

  /**
    Replace this controller's contents with an request to `url`
  */
  findAll: function() {
    var self = this;

    return this._resourceRequest({type: 'GET'})
      .done(function(json) {
        self.clearAll();
        self.loadAll(json);
      });
  },

  /**
    @private

    Base URL for requests

    Will use the `url` set for this controller, or if that's missing,
    the `url` specified for `model`.
  */
  _url: function() {
    if (this.url === undefined) {
      // If `url` is not defined for this controller, there are a couple
      // ways to retrieve it from the resource. If a resource has been instantiated,
      // then it can be retrieved from the resource's prototype. Otherwise, we need
      // to loop through the mixins for the prototype to get the url.
      var rt = this.get('model');
      if (rt.prototype.url === undefined) {
        for (var i = rt.PrototypeMixin.mixins.length - 1; i >= 0; i--) {
          var m = rt.PrototypeMixin.mixins[i];
          if (m.properties !== undefined && m.properties.url !== undefined) {
            return m.properties.url;
          }
        }
      }
      else {
        return rt.prototype.url;
      }
    }
    return this.url;
  }
});
