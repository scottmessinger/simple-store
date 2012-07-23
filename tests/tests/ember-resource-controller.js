var store = null,
    server = null;

module("SimpleStore.Collection", {
  setup: function() {
    store = SimpleStore.Store.create()
    store.contacts = SimpleStore.Collection.create({
      model: Contact
    });

    server = sinon.fakeServer.create();
  },

  teardown: function() {
    store.contacts.destroy();
    server.restore();
  }
});

test("should use the url from its corresponding resource", function() {
  equal(store.contacts._url(), "/contacts");
});

test("should use the url from a corresponding resource which has not yet been instantiated", function() {
  store.contacts.set("model", SimpleStore.Model.extend({url: '/people'}));
  equal(store.contacts._url(), "/people");
});

test("should be able to override url", function() {
  store.contacts.set("url", "/contacts/active");
  equal(store.contacts._url(), "/contacts/active");
});

test("should load a single resource from json", function() {
  equal(store.contacts.content.length, 0, "no resources loaded yet");

  store.contacts.load({id: 1, first_name: "Joe", last_name: "Blow"});

  equal(store.contacts.content.length, 1, "resource loaded");
});

test("should add the object to the index", function(){
  store.contacts.load({id: 1, first_name: "joe", last_name: "blow"})
  equal(store.contacts.content.length, store.contacts.index.length, 'added to index' )
})


test("should load an array of resources from json", function() {
  equal(store.contacts.content.length, 0, "no resources loaded yet");

  store.contacts.loadAll([{id: 1, first_name: "Joe", last_name: "Blow"},
                              {id: 2, first_name: "Jane", last_name: "Doe"}]);

  equal(store.contacts.content.length, 2, "resources loaded");
});

test("should be able to clear resources", function() {
  equal(store.contacts.content.length, 0, "no resources loaded yet");

  store.contacts.loadAll([{id: 1, first_name: "Joe", last_name: "Blow"},
                              {id: 2, first_name: "Jane", last_name: "Doe"}]);

  equal(store.contacts.content.length, 2, "resources loaded");

  store.contacts.clearAll();

  equal(store.contacts.content.length, 0, "no resources loaded");
});

test("should find by ID", function(){
   store.contacts.loadAll([{id: 1, first_name: "Joe", last_name: "Blow"},
                              {id: 2, first_name: "Jane", last_name: "Doe"}]);
 
  equal(store.contacts.findById(1).get('first_name'), "Joe", "found")
})

test("should find from server if ID is not in store", function(){
  store.contacts.loadAll([{id: 1, first_name: "Joe", last_name: "Blow"},
                              {id: 2, first_name: "Jane", last_name: "Doe"}]);
  server.respondWith("GET", "/contacts/3",
                     [200,
                      { "Content-Type": "application/json" },
                      '[{ "id": 3, "first_name": "Tall", "last_name": "Dan" }]']);

  dan = store.contacts.findById(3)
  server.respond();

  equal(dan.get('id'), 3, "found by id from server")
 
})


test("should update a record if it already exists in the store", function(){
    store.contacts.load({id: 1, first_name: "joe", last_name: "blow"})
    store.contacts.load({id: 1, first_name: "joe", last_name: "GO"})
    equal(store.contacts.get('content').length, 1, "same number of records") 
    equal(store.contacts.findById(1).get('last_name'), "GO", "same number of records") 

})

test("should find resources via ajax", function() {
  server.respondWith("GET", "/contacts",
                     [200,
                      { "Content-Type": "application/json" },
                      '[{ "id": 1, "first_name": "Joe", "last_name": "Blow" },' +
                       '{ "id": 2, "first_name": "Jane", "last_name": "Doe" }]']);

  equal(store.contacts.content.length, 0, "no resources loaded yet");

  store.contacts.findAll()
    .done(function() { ok(true,  "findAll() done"); })
    .fail(function() { ok(false, "findAll() fail"); });

  server.respond();

  equal(store.contacts.content.length, 2, "resources loaded");
});
