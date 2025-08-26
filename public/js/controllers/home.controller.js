// Home Controller
angular.module('webinarApp')
.controller('HomeController', ['$scope', 'AuthService', '$state',
  function($scope, AuthService, $state) {
    
    // Page data
    $scope.title = 'Welcome to Webinar.AI';
    $scope.subtitle = 'Create and host engaging live webinars with ease';
    
    // Join webinar form
    $scope.joinForm = {
      joinLink: ''
    };
    
    // Check if user is logged in
    $scope.isLoggedIn = function() {
      return AuthService.isLoggedIn();
    };
    
    // Get current user
    $scope.currentUser = AuthService.getCurrentUser();
    
    // Join webinar function
    $scope.joinWebinar = function() {
      if (!$scope.joinForm.joinLink) {
        return;
      }
      
      // Extract webinar ID from link
      const link = $scope.joinForm.joinLink.trim();
      let webinarId = '';
      
      // Parse different link formats
      if (link.includes('/join/')) {
        webinarId = link.split('/join/')[1];
      } else if (link.includes('webinar-')) {
        webinarId = link;
      } else {
        webinarId = link;
      }
      
      // Redirect to join page
      if (webinarId) {
        window.location.href = `/join/${webinarId}`;
      }
    };
    
    // Navigate to dashboard based on role
    $scope.goToDashboard = function() {
      const user = AuthService.getCurrentUser();
      if (user) {
        if (user.role === 'admin') {
          $state.go('admin');
        } else if (user.role === 'host') {
          $state.go('dashboard');
        }
      }
    };
    
    // Features data
    $scope.features = [
      {
        icon: '🎯',
        title: 'Easy Setup',
        description: 'Create and schedule webinars in minutes with our intuitive interface'
      },
      {
        icon: '📹',
        title: 'HD Video Quality',
        description: 'Deliver crystal-clear presentations with our optimized video streaming'
      },
      {
        icon: '💬',
        title: 'Interactive Chat',
        description: 'Engage with your audience through real-time chat and polls'
      },
      {
        icon: '📊',
        title: 'Analytics Dashboard',
        description: 'Track attendance, engagement, and performance metrics'
      },
      {
        icon: '📱',
        title: 'Mobile Friendly',
        description: 'Join webinars from any device with our responsive design'
      },
      {
        icon: '🔒',
        title: 'Secure & Reliable',
        description: 'Enterprise-grade security with 99.9% uptime guarantee'
      }
    ];
    
    // Stats data
    $scope.stats = [
      {
        number: '10K+',
        label: 'Webinars Hosted'
      },
      {
        number: '500K+',
        label: 'Attendees Reached'
      },
      {
        number: '98%',
        label: 'Satisfaction Rate'
      },
      {
        number: '24/7',
        label: 'Support Available'
      }
    ];
  }
]);
