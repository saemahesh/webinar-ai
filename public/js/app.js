// Main AngularJS Application
angular.module('webinarApp', ['ui.router'])

.config(['$stateProvider', '$urlRouterProvider', '$locationProvider', '$httpProvider',
  function($stateProvider, $urlRouterProvider, $locationProvider, $httpProvider) {
    
    // Enable HTML5 mode with fallback
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: true
    });
    
    // Default route
    $urlRouterProvider.otherwise('/');
    
    // HTTP Interceptor for JWT tokens
    $httpProvider.interceptors.push(['$q', '$injector', function($q, $injector) {
      return {
        request: function(config) {
          // Add Authorization header if token exists
          const token = localStorage.getItem('token');
          if (token && config.url.startsWith('/api/')) {
            config.headers.Authorization = 'Bearer ' + token;
          }
          return config;
        },
        
        responseError: function(rejection) {
          // Handle 401 errors globally - but only redirect if not on public pages
          if (rejection.status === 401) {
            const $state = $injector.get('$state');
            const currentState = $state.current.name;
            
            // Don't redirect to login if we're already on public pages
            const publicStates = ['home', 'joinWebinar', 'webinarRoom'];
            
            if (!publicStates.includes(currentState)) {
              const AuthService = $injector.get('AuthService');
              const ToastService = $injector.get('ToastService');
              
              AuthService.logout();
              $state.go('login');
              ToastService.error('Session expired. Please login again.');
            }
          }
          
          return $q.reject(rejection);
        }
      };
    }]);
    
    // Routes Configuration
    $stateProvider
      // Home page
      .state('home', {
        url: '/',
        templateUrl: '/views/home.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'HomeController'
      })
      
      // Authentication routes
      .state('login', {
        url: '/login',
        templateUrl: '/views/auth/login.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'LoginController'
      })
      
      .state('register', {
        url: '/register',
        templateUrl: '/views/auth/register.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'RegisterController'
      })
      
      // Admin routes
      .state('admin', {
        url: '/admin',
        templateUrl: '/views/admin/dashboard.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'AdminController',
        resolve: {
          auth: ['AuthService', function(AuthService) {
            return AuthService.init().then(function() {
              return AuthService.requireAdmin();
            });
          }]
        }
      })
      
      // Host routes
      .state('dashboard', {
        url: '/dashboard',
        templateUrl: '/views/host/dashboard.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'DashboardController',
        resolve: {
          auth: ['AuthService', function(AuthService) {
            return AuthService.requireHost();
          }]
        }
      })
      
      // Webinar details page for hosts
      .state('webinarDetails', {
        url: '/webinars/:webinarId',
        templateUrl: '/views/host/webinar-details.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'WebinarDetailsController',
        resolve: {
          auth: ['AuthService', function(AuthService) {
            return AuthService.requireHost();
          }]
        }
      })
      
      // Public webinar join page
      .state('joinWebinar', {
        url: '/join/:webinarId',
        templateUrl: '/views/public/join-webinar.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'JoinWebinarController'
      })
      
      // Webinar room for attendees
      .state('webinarRoom', {
        url: '/webinar-room/:webinarId',
        templateUrl: '/views/webinar-room.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'WebinarRoomController'
      })
      
      // Webinar ended page
      .state('webinar-ended', {
        url: '/webinar-ended/:webinarId',
        templateUrl: '/views/webinar-ended.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'WebinarEndedController'
      })
      
      // Alternative join route (used by room controller redirects)
      .state('join', {
        url: '/register/:webinarId',
        templateUrl: '/views/public/join-webinar.html?v=' + (window.__APP_VERSION || Date.now()),
        controller: 'JoinWebinarController'
      });
  }
])

// Run block - Initialize app
.run(['$rootScope', '$state', 'AuthService', 'ToastService',
  function($rootScope, $state, AuthService, ToastService) {
    
    // Global loading state
    $rootScope.loading = false;
    $rootScope.hideHeader = false; // control header visibility globally
    
    // Check authentication on state change
    $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {
      
      // Show loading
      $rootScope.loading = true;
      
      // Hide header on join routes
      $rootScope.hideHeader = toState && (toState.name === 'joinWebinar' || toState.name === 'join');
      
      // Check if route requires authentication
      if (toState.resolve && toState.resolve.auth) {
        if (!AuthService.isLoggedIn()) {
          event.preventDefault();
          $state.go('login');
          ToastService.error('Please login to access this page');
        }
      }
    });
    
    // Hide loading on state change success
    $rootScope.$on('$stateChangeSuccess', function() {
      $rootScope.loading = false;
    });
    
    // Handle state change errors
    $rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams, error) {
      $rootScope.loading = false;
      console.error('State change error:', error);
      
      if (error && error.status === 401) {
        AuthService.logout();
        $state.go('login');
        ToastService.error('Session expired. Please login again.');
      } else if (error && error.status === 403) {
        $state.go('home');
        ToastService.error('Access denied');
      } else {
        ToastService.error('An error occurred. Please try again.');
      }
    });
    
    // Initialize authentication state
    AuthService.init();
  }
]);
