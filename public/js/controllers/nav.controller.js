// Navigation Controller
angular.module('webinarApp')
.controller('NavController', ['$scope', 'AuthService', 'ToastService', '$state', '$location',
  function($scope, AuthService, ToastService, $state, $location) {
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Check if user is logged in
    $scope.isLoggedIn = function() {
      return AuthService.isLoggedIn();
    };
    
    // Get current user
    $scope.currentUser = null;
    
    // Update current user when authentication state changes
    const updateCurrentUser = () => {
      $scope.currentUser = AuthService.getCurrentUser();
    };
    
    // Watch for authentication changes
    $scope.$watch(() => AuthService.isLoggedIn(), updateCurrentUser);
    $scope.$watch(() => AuthService.getCurrentUser(), updateCurrentUser);
    
    // Logout function
    $scope.logout = function() {
      AuthService.logout();
      $state.go('home');
      ToastService.success('Logged out successfully');
      $scope.mobileMenuOpen = false; // Close mobile menu on logout
    };
    
    // Hide nav on join page
    $scope.isJoinPage = function() {
      // Match /join/:id or /webinar-room/:id etc. Only hide on join page per request
      const path = $location.path() || '';
      return /^\/join\//.test(path);
    };
    
    // Initialize
    updateCurrentUser();
  }
]);
