// Register Controller
angular.module('webinarApp')
.controller('RegisterController', ['$scope', 'AuthService', 'ToastService', '$state',
  function($scope, AuthService, ToastService, $state) {
    
    // Form data
    $scope.registerForm = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    };
    
    // Loading state
    $scope.isLoading = false;
    
    // Errors
    $scope.errors = {};
    
    // Register function
    $scope.register = function() {
      // Reset errors
      $scope.errors = {};
      
      // Validation
      if (!$scope.registerForm.name) {
        $scope.errors.name = 'Full name is required';
        return;
      }
      
      if (!$scope.registerForm.email) {
        $scope.errors.email = 'Email is required';
        return;
      }
      
      if (!$scope.registerForm.password) {
        $scope.errors.password = 'Password is required';
        return;
      }
      
      if ($scope.registerForm.password.length < 6) {
        $scope.errors.password = 'Password must be at least 6 characters long';
        return;
      }
      
      if (!$scope.registerForm.confirmPassword) {
        $scope.errors.confirmPassword = 'Please confirm your password';
        return;
      }
      
      if ($scope.registerForm.password !== $scope.registerForm.confirmPassword) {
        $scope.errors.confirmPassword = 'Passwords do not match';
        return;
      }
      
      if (!$scope.registerForm.acceptTerms) {
        $scope.errors.acceptTerms = 'You must accept the terms and conditions';
        return;
      }
      
      // Set loading state
      $scope.isLoading = true;
      
      // Attempt registration
      AuthService.register($scope.registerForm)
        .then((response) => {
          ToastService.success('Registration successful! Your account is pending approval.');
          $state.go('login');
        })
        .catch((error) => {
          console.error('Registration error:', error);
          
          if (error.status === 409) {
            $scope.errors.email = 'An account with this email already exists';
            ToastService.error('An account with this email already exists');
          } else if (error.data && error.data.error) {
            ToastService.error(error.data.error);
          } else {
            ToastService.error('Registration failed. Please try again.');
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
