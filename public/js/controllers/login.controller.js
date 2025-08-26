// Login Controller
angular.module('webinarApp')
.controller('LoginController', ['$scope', 'AuthService', 'ToastService', '$state',
  function($scope, AuthService, ToastService, $state) {
    
    // Form data
    $scope.loginForm = {
      email: '',
      password: '',
      rememberMe: false
    };
    
    // Loading state
    $scope.isLoading = false;
    
    // Errors
    $scope.errors = {};
    
    // Login function
    $scope.login = function() {
      // Reset errors
      $scope.errors = {};
      
      // Basic validation
      if (!$scope.loginForm.email) {
        $scope.errors.email = 'Email is required';
        return;
      }
      
      if (!$scope.loginForm.password) {
        $scope.errors.password = 'Password is required';
        return;
      }
      
      // Set loading state
      $scope.isLoading = true;
      
      console.log('Attempting login for:', $scope.loginForm.email);
      
      // Attempt login
      AuthService.login($scope.loginForm)
        .then((response) => {
          console.log('Login successful:', response);
          ToastService.success('Login successful! Welcome back.');
          
          // Redirect based on user role
          const user = AuthService.getCurrentUser();
          if (user.role === 'admin') {
            $state.go('admin');
          } else if (user.role === 'host') {
            if (user.status === 'approved') {
              $state.go('dashboard');
            } else {
              ToastService.warning('Your account is pending approval. Please wait for admin approval.');
              $state.go('home');
            }
          } else {
            $state.go('home');
          }
        })
        .catch((error) => {
          console.error('Login error:', error);
          console.error('Error status:', error.status);
          console.error('Error data:', error.data);
          
          if (error.status === 429) {
            ToastService.error('Too many login attempts. Please try again later.');
          } else if (error.status === 401) {
            ToastService.error('Invalid email or password');
          } else if (error.data && error.data.error) {
            ToastService.error(error.data.error);
          } else {
            ToastService.error('Login failed. Please try again.');
          }
        })
        .finally(() => {
          $scope.isLoading = false;
        });
    };
    
    // Check if already logged in
    if (AuthService.isLoggedIn()) {
      const user = AuthService.getCurrentUser();
      if (user.role === 'admin') {
        $state.go('admin');
      } else if (user.role === 'host' && user.status === 'approved') {
        $state.go('dashboard');
      } else {
        $state.go('home');
      }
    }
  }
]);
