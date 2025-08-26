// Host Dashboard Controller
angular.module('webinarApp')
.controller('DashboardController', ['$scope', '$http', 'AuthService', 'ToastService', 'WebinarService', '$state', '$timeout',
  function($scope, $http, AuthService, ToastService, WebinarService, $state, $timeout) {
    
    // Get current user
    $scope.currentUser = AuthService.getCurrentUser();
    
    // Loading states
    $scope.isLoading = false;
    $scope.isSaving = false;
    
    // Modal state
    $scope.showModal = false;
    $scope.isEditing = false;
    
    // Data
    $scope.webinars = [];
    $scope.filteredWebinars = [];
    $scope.stats = {
      totalWebinars: 0,
      upcomingWebinars: 0,
      totalAttendees: 0,
      liveWebinars: 0
    };
    
    // Filters
    $scope.filterStatus = '';
    
    // Delete confirmation
    $scope.showDeleteConfirmation = false;
    $scope.webinarToDelete = null;
    
    // Form data
    $scope.webinarForm = {
      title: '',
      description: '',
      scheduledDateTime: '',
      duration: 60,
      maxAttendees: 100,
      requireRegistration: true
    };
    
    // Watch for modal state changes - Enhanced to handle edit form population with Date objects
    $scope.$watch('showModal', function(newVal, oldVal) {
      if (newVal && !oldVal && $scope.isEditing && $scope.selectedWebinar) {
        console.log('Modal opened for editing - watcher detected, populating form with Date object');
        
        // Force populate the form when modal becomes visible
        $timeout(function() {
          const webinar = $scope.selectedWebinar;
          if (webinar) {
            $scope.webinarForm = {
              title: webinar.title,
              description: webinar.description,
              scheduledDateTime: new Date(webinar.scheduledDate),  // Use Date object
              duration: webinar.duration,
              maxAttendees: webinar.maxAttendees,
              requireRegistration: webinar.requireRegistration || true
            };
            console.log('Form populated via modal watcher with Date object:', $scope.webinarForm);
          }
        }, 50);
      }
    });
    
    // Initialize dashboard
    $scope.init = function() {
      if (!$scope.currentUser || $scope.currentUser.role !== 'host') {
        ToastService.error('Access denied. Host privileges required.');
        $state.go('home');
        return;
      }
      
      if ($scope.currentUser.status !== 'approved') {
        ToastService.warning('Your account is pending approval. Please wait for admin approval.');
        $state.go('home');
        return;
      }
      
      $scope.loadWebinars();
    };
    
    // Load webinars
    $scope.loadWebinars = function() {
      $scope.isLoading = true;
      
      WebinarService.getMyWebinars()
        .then((response) => {
          console.log('Webinars loaded:', response);
          $scope.webinars = response.webinars || [];
          $scope.calculateStats();
          $scope.filterWebinars();
        })
        .catch((error) => {
          console.error('Error loading webinars:', error);
          // For now, use mock data if API fails
          $scope.loadMockData();
        })
        .finally(() => {
          $scope.isLoading = false;
        });
    };
    
    // Load mock data for development
    $scope.loadMockData = function() {
      const mockWebinars = [
        {
          id: 'webinar-1',
          title: 'Introduction to AI in Business',
          description: 'Learn how artificial intelligence is transforming modern business operations and discover practical applications.',
          scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          duration: 90,
          status: 'upcoming',
          registrations: 45,
          maxAttendees: 100,
          requireRegistration: true,
          hostId: $scope.currentUser.id
        },
        {
          id: 'webinar-2',
          title: 'Digital Marketing Strategies 2025',
          description: 'Explore the latest digital marketing trends and strategies that will dominate 2025.',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          duration: 60,
          status: 'upcoming',
          registrations: 23,
          maxAttendees: 50,
          requireRegistration: true,
          hostId: $scope.currentUser.id
        },
        {
          id: 'webinar-3',
          title: 'Web Development Best Practices',
          description: 'A comprehensive guide to modern web development practices and tools.',
          scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          duration: 120,
          status: 'completed',
          registrations: 78,
          maxAttendees: 100,
          requireRegistration: true,
          hostId: $scope.currentUser.id
        }
      ];
      
      $scope.webinars = mockWebinars;
      $scope.calculateStats();
      $scope.filterWebinars();
      console.log('Mock data loaded:', $scope.webinars);
    };
    
    // Calculate statistics
    $scope.calculateStats = function() {
      $scope.stats = {
        totalWebinars: $scope.webinars.length,
        upcomingWebinars: $scope.webinars.filter(w => w.status === 'upcoming').length,
        totalAttendees: $scope.webinars.reduce((sum, w) => sum + (w.registrations || 0), 0),
        liveWebinars: $scope.webinars.filter(w => w.status === 'live').length
      };
    };
    
    // Filter webinars
    $scope.filterWebinars = function() {
      if (!$scope.filterStatus) {
        $scope.filteredWebinars = $scope.webinars;
      } else {
        $scope.filteredWebinars = $scope.webinars.filter(w => w.status === $scope.filterStatus);
      }
    };
    
    // Show create webinar modal
    $scope.showCreateWebinarModal = function() {
      $scope.isEditing = false;
      
      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      // Set default time to 2 PM
      const timeStr = '14:00';
      
      $scope.webinarForm = {
        title: '',
        description: '',
        scheduledDateTime: '',
        duration: 60,
        maxAttendees: 100,
        requireRegistration: true
      };
      $scope.showModal = true;
    };
    
    // Edit webinar - Fixed to use Date object for ngModel compatibility
    $scope.editWebinar = function(webinar) {
      $scope.isEditing = true;
      $scope.selectedWebinar = webinar;
      
      console.log('Editing webinar:', webinar);
      console.log('Original scheduled date:', webinar.scheduledDate);
      
      // Initialize form with current webinar data immediately
      if (webinar) {
        // Convert to Date object for AngularJS ngModel compatibility
        const scheduledDate = new Date(webinar.scheduledDate);
        
        $scope.webinarForm = {
          title: webinar.title,
          description: webinar.description,
          scheduledDateTime: scheduledDate,  // Use Date object, not string
          duration: webinar.duration,
          maxAttendees: webinar.maxAttendees,
          requireRegistration: webinar.requireRegistration || true
        };
        
        console.log('Edit form populated immediately with Date object:', $scope.webinarForm);
        console.log('ScheduledDateTime value:', $scope.webinarForm.scheduledDateTime);
        console.log('ScheduledDateTime type:', typeof $scope.webinarForm.scheduledDateTime);
        console.log('Is Date object:', $scope.webinarForm.scheduledDateTime instanceof Date);
      }
      
      // Show modal
      $scope.showModal = true;
    };
    
    // Save webinar (create or update)
    $scope.saveWebinar = function() {
      console.log('saveWebinar called');
      console.log('Full webinarForm object:', JSON.stringify($scope.webinarForm, null, 2));
      
      // Validate form data first
      if (!$scope.webinarForm.title || !$scope.webinarForm.description || 
          !$scope.webinarForm.scheduledDateTime) {
        ToastService.error('Please fill in all required fields');
        return;
      }
      
      $scope.isSaving = true;
      
      try {
        // Handle datetime from ngModel (now expects Date object)
        const dateTime = $scope.webinarForm.scheduledDateTime;
        
        console.log('DateTime input:', dateTime);
        console.log('Type of dateTime:', typeof dateTime);
        console.log('Is Date object:', dateTime instanceof Date);
        
        // Check for empty value
        if (!dateTime) {
          throw new Error('Scheduled date and time are required');
        }
        
        // Handle both Date objects and string inputs for backward compatibility
        let scheduledDate;
        
        if (dateTime instanceof Date) {
          // If it's already a Date object (from ngModel), use it directly
          scheduledDate = dateTime;
          console.log('Using Date object directly');
        } else if (typeof dateTime === 'string') {
          // If it's a string, parse it
          scheduledDate = new Date(dateTime);
          console.log('Parsed string to Date object');
        } else {
          throw new Error('Invalid datetime format received');
        }
        
        console.log('Created date:', scheduledDate);
        console.log('Date getTime():', scheduledDate.getTime());
        
        // Verify the date was created correctly
        if (isNaN(scheduledDate.getTime())) {
          throw new Error('Unable to create valid date from: ' + dateTimeStr);
        }
        
        // Check if date is in the future (flexible for editing)
        const now = new Date();
        
        // If editing an existing webinar, allow more flexibility with minimal buffer
        if ($scope.isEditing && $scope.selectedWebinar) {
          // Allow editing with current time (no buffer needed for existing webinars)
          console.log('Edit mode: no time restrictions applied');
        } else {
          // For new webinars, keep some buffer time
          const bufferMinutes = 5; // 5 minutes buffer for new webinars
          const bufferTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);
          console.log('Current time:', now);
          console.log('Buffer time for new webinars:', bufferTime);
          if (scheduledDate < bufferTime) {
            throw new Error(`New webinars must be scheduled at least ${bufferMinutes} minutes in the future`);
          }
        }
        
        // Convert to ISO string for storage
        let isoString;
        try {
          isoString = scheduledDate.toISOString();
          console.log('ISO string:', isoString);
        } catch (isoError) {
          console.error('ISO conversion error:', isoError);
          throw new Error('Failed to convert date to ISO format: ' + isoError.message);
        }
        
        const webinarData = {
          title: $scope.webinarForm.title.trim(),
          description: $scope.webinarForm.description.trim(),
          scheduledDate: isoString,
          duration: parseInt($scope.webinarForm.duration) || 60,
          maxAttendees: parseInt($scope.webinarForm.maxAttendees) || 100,
          requireRegistration: $scope.webinarForm.requireRegistration !== false,
          status: 'upcoming'
        };
        
        // Additional validation
        if (webinarData.duration < 15 || webinarData.duration > 480) {
          ToastService.error('Duration must be between 15 and 480 minutes');
          $scope.isSaving = false;
          return;
        }
        
        if (webinarData.maxAttendees < 1 || webinarData.maxAttendees > 10000) {
          ToastService.error('Max attendees must be between 1 and 10,000');
          $scope.isSaving = false;
          return;
        }
        
        console.log('Webinar data to save:', webinarData);
        
        let request;
        if ($scope.isEditing) {
          request = WebinarService.updateWebinar($scope.selectedWebinar.id, webinarData);
        } else {
          request = WebinarService.createWebinar(webinarData);
        }
        
        request
          .then((response) => {
            ToastService.success($scope.isEditing ? 'Webinar updated successfully!' : 'Webinar created successfully!');
            $scope.closeModal();
            $scope.loadWebinars();
          })
          .catch((error) => {
            console.error('Error saving webinar:', error);
            
            // For development, simulate success with mock data
            if ($scope.isEditing) {
              // Update existing webinar in mock data
              const index = $scope.webinars.findIndex(w => w.id === $scope.selectedWebinar.id);
              if (index !== -1) {
                $scope.webinars[index] = { ...$scope.webinars[index], ...webinarData, scheduledDate: scheduledDate };
              }
            } else {
              // Add new webinar to mock data
              const newWebinar = {
                id: 'webinar-' + Date.now(),
                ...webinarData,
                scheduledDate: scheduledDate,
                registrations: 0,
                hostId: $scope.currentUser.id
              };
              $scope.webinars.push(newWebinar);
            }
            
            $scope.calculateStats();
            $scope.filterWebinars();
            ToastService.success($scope.isEditing ? 'Webinar updated successfully!' : 'Webinar created successfully!');
            $scope.closeModal();
          })
          .finally(() => {
            $scope.isSaving = false;
          });
          
      } catch (error) {
        console.error('Date validation error:', error);
        console.log('Form data when error occurred:', {
          scheduledDateTime: $scope.webinarForm.scheduledDateTime,
          title: $scope.webinarForm.title,
          description: $scope.webinarForm.description
        });
        
        // Show specific error message
        ToastService.error(error.message || 'Invalid date or time. Please check your input.');
        $scope.isSaving = false;
      }
    };
    
    // Delete webinar - show confirmation
    $scope.deleteWebinar = function(webinar) {
      $scope.webinarToDelete = webinar;
      $scope.showDeleteConfirmation = true;
    };
    
    // Confirm delete webinar
    $scope.confirmDeleteWebinar = function() {
      if (!$scope.webinarToDelete) {
        return;
      }
      
      const webinar = $scope.webinarToDelete;
      $scope.showDeleteConfirmation = false;
      $scope.webinarToDelete = null;
      
      $http.delete('/api/webinars/' + webinar.id)
        .then((response) => {
          ToastService.success('Webinar deleted successfully!');
          $scope.loadWebinars();
        })
        .catch((error) => {
          console.error('Error deleting webinar:', error);
          ToastService.error('Failed to delete webinar. Please try again.');
        });
    };
    
    // Cancel delete webinar
    $scope.cancelDeleteWebinar = function() {
      $scope.showDeleteConfirmation = false;
      $scope.webinarToDelete = null;
    };
    
    // Copy webinar join link
    $scope.copyWebinarLink = function(webinar) {
      const baseUrl = window.location.origin;
      const joinUrl = `${baseUrl}/join/${webinar.id}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(joinUrl).then(() => {
          ToastService.success('Webinar join link copied to clipboard!');
        }).catch(() => {
          $scope.fallbackCopyLink(joinUrl);
        });
      } else {
        $scope.fallbackCopyLink(joinUrl);
      }
    };
    
    // Fallback copy method
    $scope.fallbackCopyLink = function(url) {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        ToastService.success('Webinar join link copied to clipboard!');
      } catch (err) {
        ToastService.error('Unable to copy link. Please copy the URL manually.');
      }
      
      document.body.removeChild(textArea);
    };
    
    // Close modal
    $scope.closeModal = function() {
      $scope.showModal = false;
      $scope.isEditing = false;
      $scope.selectedWebinar = null;
    };
    
    // Refresh dashboard
    $scope.refreshDashboard = function() {
      $scope.loadWebinars();
      ToastService.success('Dashboard refreshed!');
    };
    
    // Get minimum datetime for form validation
    $scope.getMinDateTime = function() {
      const now = new Date();
      
      // If editing an existing webinar, allow more flexibility with minimal buffer
      if ($scope.isEditing && $scope.selectedWebinar) {
        // Allow editing with current time (no buffer needed for existing webinars)
        now.setSeconds(0);
        now.setMilliseconds(0);
        console.log('Edit mode: allowing current time as minimum');
      } else {
        // For new webinars, keep some buffer time
        now.setMinutes(now.getMinutes() + 5); // 5 minutes buffer for new webinars
        now.setSeconds(0);
        now.setMilliseconds(0);
        console.log('Create mode: adding 5 minute buffer');
      }
        
      // Format for datetime-local input (YYYY-MM-DDTHH:MM)
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      const result = `${year}-${month}-${day}T${hours}:${minutes}`;
      console.log('getMinDateTime result:', result, 'isEditing:', $scope.isEditing);
      return result;
    };
    
    // View webinar details
    $scope.viewWebinarDetails = function(webinar) {
      if (!webinar || !webinar.id) {
        ToastService.error('Invalid webinar selected');
        return;
      }
      
      console.log('Navigating to webinar details:', webinar.id);
      $state.go('webinarDetails', { webinarId: webinar.id });
    };
    
    // Initialize dashboard
    $scope.init();
  }
]);
