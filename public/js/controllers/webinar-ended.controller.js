angular.module('webinarApp')
.controller('WebinarEndedController', ['$scope', '$state', '$stateParams', '$http', 'ToastService',
  function($scope, $state, $stateParams, $http, ToastService) {
    
    console.log('WebinarEndedController loaded for webinar:', $stateParams.webinarId);
    
    // Initialize scope variables
    $scope.webinarId = $stateParams.webinarId;
    $scope.webinar = {};
    $scope.endedInfo = {};
    
    // Load webinar details
    $scope.loadWebinarDetails = function() {
      console.log('Loading webinar details for ended webinar:', $scope.webinarId);
      
      // Try to get webinar details from public API
      $http.get(`/api/public/webinars/${$scope.webinarId}`)
        .then(function(response) {
          console.log('Webinar details loaded:', response.data);
          $scope.webinar = response.data.webinar || response.data;
          
          // Load any stored ended webinar info
          const endedInfo = localStorage.getItem(`ended_webinar_${$scope.webinarId}`);
          if (endedInfo) {
            $scope.endedInfo = JSON.parse(endedInfo);
            console.log('Ended webinar info:', $scope.endedInfo);
          }
        })
        .catch(function(error) {
          console.error('Failed to load webinar details:', error);
          ToastService.error('Failed to load webinar details');
          // Fallback to home if webinar not found
          $scope.goToHome();
        });
    };
    
    // Navigation functions
    $scope.goToHome = function() {
      console.log('Navigating to home page');
      $state.go('home');
    };
    
    $scope.browseWebinars = function() {
      console.log('Navigating to browse webinars');
      $state.go('home'); // or 'webinars' if you have a webinars listing page
    };
    
    // Feedback functions
    $scope.submitRating = function(rating) {
      console.log('Rating submitted:', rating, 'stars for webinar:', $scope.webinarId);
      
      // Store rating locally (you can extend this to send to server)
      const feedbackData = {
        webinarId: $scope.webinarId,
        rating: rating,
        submittedAt: new Date().toISOString()
      };
      
      localStorage.setItem(`feedback_${$scope.webinarId}`, JSON.stringify(feedbackData));
      
      // Show success message
      let ratingText = '';
      switch(rating) {
        case 5: ratingText = 'Excellent'; break;
        case 4: ratingText = 'Good'; break;
        case 3: ratingText = 'Average'; break;
        default: ratingText = rating + ' stars';
      }
      
      ToastService.success(`Thank you for rating this webinar ${ratingText}!`);
      
      // Optional: Send feedback to server
      $scope.sendFeedbackToServer(feedbackData);
    };
    
    $scope.sendFeedbackToServer = function(feedbackData) {
      // This is optional - you can implement server-side feedback storage
      $http.post('/api/public/feedback', feedbackData)
        .then(function(response) {
          console.log('Feedback sent to server successfully:', response.data);
        })
        .catch(function(error) {
          console.log('Failed to send feedback to server (optional):', error);
          // Don't show error to user as this is optional
        });
    };
    
    // Initialize controller
    $scope.loadWebinarDetails();
    
    // Cleanup ended webinar info after a delay
    setTimeout(function() {
      localStorage.removeItem(`ended_webinar_${$scope.webinarId}`);
      console.log('Cleaned up ended webinar info from localStorage');
    }, 30000); // Clean up after 30 seconds
    
  }
]);
