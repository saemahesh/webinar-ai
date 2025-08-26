// Toast Notification Service
angular.module('webinarApp')
.service('ToastService', ['$timeout', '$rootScope', function($timeout, $rootScope) {
  
  const service = {
    toasts: [],
    
    // Show success toast
    success: function(message, duration = 5000) {
      this.show(message, 'success', duration);
    },
    
    // Show error toast
    error: function(message, duration = 7000) {
      this.show(message, 'error', duration);
    },
    
    // Show info toast
    info: function(message, duration = 5000) {
      this.show(message, 'info', duration);
    },
    
    // Show warning toast
    warning: function(message, duration = 6000) {
      this.show(message, 'warning', duration);
    },
    
    // Show toast with custom type
    show: function(message, type = 'info', duration = 5000) {
      const toast = {
        id: Date.now() + Math.random(),
        message: message,
        type: type,
        show: false
      };
      
      this.toasts.push(toast);
      
      // Trigger animation
      $timeout(() => {
        toast.show = true;
      }, 100);
      
      // Auto remove
      if (duration > 0) {
        $timeout(() => {
          this.remove(toast.id);
        }, duration);
      }
      
      // Broadcast to controllers
      $rootScope.$broadcast('toast:added', toast);
    },
    
    // Remove toast by ID
    remove: function(id) {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index !== -1) {
        this.toasts[index].show = false;
        
        // Remove from array after animation
        $timeout(() => {
          const currentIndex = this.toasts.findIndex(t => t.id === id);
          if (currentIndex !== -1) {
            this.toasts.splice(currentIndex, 1);
          }
        }, 300);
      }
    },
    
    // Remove toast by index
    removeByIndex: function(index) {
      if (index >= 0 && index < this.toasts.length) {
        const toast = this.toasts[index];
        this.remove(toast.id);
      }
    },
    
    // Clear all toasts
    clear: function() {
      this.toasts.forEach(toast => {
        toast.show = false;
      });
      
      $timeout(() => {
        this.toasts.length = 0;
      }, 300);
    },
    
    // Get all toasts
    getToasts: function() {
      return this.toasts;
    }
  };
  
  return service;
}]);
