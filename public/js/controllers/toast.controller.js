// Toast Controller
angular.module('webinarApp')
.controller('ToastController', ['$scope', 'ToastService',
  function($scope, ToastService) {
    
    // Get toasts from service
    $scope.toasts = ToastService.getToasts();
    
    // Remove toast function
    $scope.removeToast = function(index) {
      ToastService.removeByIndex(index);
    };
    
    // Listen for new toasts
    $scope.$on('toast:added', function(event, toast) {
      // Toast is already in the service array
      // This event can be used for additional actions if needed
    });
  }
]);
