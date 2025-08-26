// Authentication Service
angular.module('webinarApp')
.service('AuthService', ['$http', '$q', function($http, $q) {
  
  let currentUser = null;
  let isAuthenticated = false;
  let initPromise = null;
  
  const service = {
    
    // Initialize authentication state
    init: function() {
      if (initPromise) {
        return initPromise; // Return existing promise if already initializing
      }
      
      const token = localStorage.getItem('token');
      if (token) {
        initPromise = this.verifyToken().then(() => {
          console.log('User authenticated from token');
        }).catch(() => {
          this.logout();
          console.log('Token verification failed');
        });
        return initPromise;
      } else {
        // No token, resolve immediately
        initPromise = $q.resolve();
        return initPromise;
      }
    },
    
    // Login user
    login: function(credentials) {
      return $http.post('/api/auth/login', credentials)
        .then((response) => {
          const { token, user } = response.data;
          
          // Store token and user data
          localStorage.setItem('token', token);
          currentUser = user;
          isAuthenticated = true;
          
          return response.data;
        });
    },
    
    // Register new host
    register: function(userData) {
      return $http.post('/api/auth/register', userData)
        .then((response) => {
          return response.data;
        });
    },
    
    // Logout user
    logout: function() {
      localStorage.removeItem('token');
      currentUser = null;
      isAuthenticated = false;
    },
    
    // Verify JWT token
    verifyToken: function() {
      const deferred = $q.defer();
      
      $http.get('/api/auth/verify')
        .then((response) => {
          currentUser = response.data.user;
          isAuthenticated = true;
          deferred.resolve(response.data);
        })
        .catch((error) => {
          this.logout();
          deferred.reject(error);
        });
      
      return deferred.promise;
    },
    
    // Check if user is logged in
    isLoggedIn: function() {
      return isAuthenticated && currentUser !== null;
    },
    
    // Get current user
    getCurrentUser: function() {
      return currentUser;
    },
    
    // Check if user is admin
    isAdmin: function() {
      return this.isLoggedIn() && currentUser.role === 'admin';
    },
    
    // Check if user is host
    isHost: function() {
      return this.isLoggedIn() && currentUser.role === 'host';
    },
    
    // Check if user is approved
    isApproved: function() {
      return this.isLoggedIn() && currentUser.status === 'approved';
    },
    
    // Require admin access
    requireAdmin: function() {
      const deferred = $q.defer();
      
      // Initialize authentication if not already done
      this.init().then(() => {
        if (!this.isLoggedIn()) {
          deferred.reject({ status: 401, message: 'Not authenticated' });
        } else if (!this.isAdmin()) {
          deferred.reject({ status: 403, message: 'Admin access required' });
        } else {
          deferred.resolve(currentUser);
        }
      }).catch((error) => {
        deferred.reject({ status: 401, message: 'Authentication failed' });
      });
      
      return deferred.promise;
    },
    
    // Require host access
    requireHost: function() {
      const deferred = $q.defer();
      
      // Initialize authentication if not already done
      this.init().then(() => {
        if (!this.isLoggedIn()) {
          deferred.reject({ status: 401, message: 'Not authenticated' });
        } else if (!this.isHost() && !this.isAdmin()) {
          deferred.reject({ status: 403, message: 'Host access required' });
        } else if (!this.isApproved()) {
          deferred.reject({ status: 403, message: 'Account not approved' });
        } else {
          deferred.resolve(currentUser);
        }
      }).catch((error) => {
        deferred.reject({ status: 401, message: 'Authentication failed' });
      });
      
      return deferred.promise;
    }
  };
  
  return service;
}]);
