// File upload directive
angular.module('webinarApp')
.directive('ngFileSelect', ['$parse', function($parse) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      const fn = $parse(attrs.ngFileSelect);
      
      element.on('change', function(event) {
        const files = event.target.files;
        
        scope.$apply(function() {
          fn(scope, { $files: files });
        });
        
        // Clear the input so the same file can be selected again
        element.val('');
      });
      
      // Handle drag and drop
      const dropArea = element.parent();
      
      dropArea.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.addClass('border-blue-400 bg-blue-800');
      });
      
      dropArea.on('dragleave dragend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.removeClass('border-blue-400 bg-blue-800');
      });
      
      dropArea.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropArea.removeClass('border-blue-400 bg-blue-800');
        
        const files = e.originalEvent.dataTransfer.files;
        
        scope.$apply(function() {
          fn(scope, { $files: files });
        });
      });
      
      // Cleanup
      scope.$on('$destroy', function() {
        element.off('change');
        dropArea.off('dragover dragenter dragleave dragend drop');
      });
    }
  };
}]);
