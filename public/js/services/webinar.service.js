// Webinar Service
angular.module('webinarApp')
.service('WebinarService', ['$http', '$q', function($http, $q) {
  
  const service = {
    
    // Get host's webinars
    getMyWebinars: function() {
      return $http.get('/api/webinars/my-webinars')
        .then((response) => {
          return response.data;
        });
    },
    
    // Get all public webinars
    getAllWebinars: function() {
      return $http.get('/api/webinars')
        .then((response) => {
          return response.data;
        });
    },
    
    // Create new webinar
    createWebinar: function(webinarData) {
      return $http.post('/api/webinars', webinarData)
        .then((response) => {
          return response.data;
        });
    },
    
    // Update webinar
    updateWebinar: function(webinarId, webinarData) {
      return $http.put('/api/webinars/' + webinarId, webinarData)
        .then((response) => {
          return response.data;
        });
    },
    
    // Delete webinar
    deleteWebinar: function(webinarId) {
      return $http.delete('/api/webinars/' + webinarId)
        .then((response) => {
          return response.data;
        });
    },
    
    // Start webinar live
    startWebinar: function(webinarId) {
      return $http.post('/api/webinars/' + webinarId + '/start')
        .then((response) => {
          return response.data;
        });
    },
    
    // Get webinar by ID
    getWebinar: function(webinarId) {
      return $http.get('/api/webinars/' + webinarId)
        .then((response) => {
          return response.data;
        });
    },
    
    // Register for webinar
    registerForWebinar: function(webinarId, registrationData) {
      return $http.post('/api/webinars/' + webinarId + '/register', registrationData)
        .then((response) => {
          return response.data;
        });
    },
    
    // Join webinar
    joinWebinar: function(webinarId, joinData) {
      return $http.post('/api/webinars/' + webinarId + '/join', joinData)
        .then((response) => {
          return response.data;
        });
    },

    // Save scheduled automated messages (host)
    saveScheduledMessages: function(webinarId, scheduledMessages) {
      return $http.put('/api/webinars/' + webinarId + '/scheduled-messages', { scheduledMessages })
        .then((response) => response.data);
    }
  };
  
  return service;
}]);
