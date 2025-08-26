// Webinar Details Controller
angular.module('webinarApp')
.controller('WebinarDetailsController', ['$scope', '$http', '$stateParams', 'AuthService', 'ToastService', '$state', '$window', '$timeout',
  function($scope, $http, $stateParams, AuthService, ToastService, $state, $window, $timeout) {
    
    console.log('🚀🚀🚀 WEBINAR DETAILS CONTROLLER STARTING 🚀🚀🚀');
    console.log('📅 Current timestamp:', new Date().toLocaleTimeString());
    console.log('🔐 localStorage available:', typeof(Storage) !== "undefined");
    console.log('💾 Current webinar-details-active-tab value:', localStorage.getItem('webinar-details-active-tab'));
    
    // Get webinar ID from URL
    const webinarId = $stateParams.webinarId;
    console.log('🆔 Webinar ID from URL:', webinarId);
    
    // Get current user
    $scope.currentUser = AuthService.getCurrentUser();
    
    // Loading states
    $scope.isLoading = true;
    $scope.isUpdating = false;
    $scope.uploadProgress = null;
    
    // Data
    $scope.webinar = null;
    $scope.attendees = [];
  $scope.filteredAttendees = [];
    // Dynamic custom field columns to display in attendees table
    $scope.customFieldColumns = [];
    $scope.error = null;
    
    // Automated Messages Scheduler
    $scope.scheduledMessages = [];
    $scope.messageScheduler = {
      open: false,
      videoUrl: null,
      currentTime: 0,
      editing: [],
      saving: false
    };
    
    // Delete confirmation dialog
    $scope.deleteConfirmation = {
      open: false,
      messageId: null,
      title: '',
      message: ''
    };
    
    // UI state - Initialize immediately with saved tab to avoid flash
    const savedTab = localStorage.getItem('webinar-details-active-tab');
    const validTabs = ['overview', 'video', 'forms', 'attendees', 'messages', 'analytics', 'settings'];
    
    // Set initial tab immediately to avoid flash
    if (savedTab && validTabs.includes(savedTab)) {
      console.log('🚀 Setting initial tab immediately to saved value:', savedTab);
      $scope.activeTab = savedTab;
    } else {
      console.log('🚀 Setting initial tab to default: overview');
      $scope.activeTab = 'overview';
    }
    
    // Add debug functions for tab clicks
    $scope.debugTabClick = function(tabName) {
      console.log('🖱️🖱️🖱️ USER CLICKED TAB:', tabName, 'at', new Date().toLocaleTimeString());
      console.log('🔄 Setting activeTab from', $scope.activeTab, 'to', tabName);
      $scope.activeTab = tabName;
    };
    
    $scope.debugMobileSelect = function() {
      console.log('📱📱📱 MOBILE SELECT CHANGED TO:', $scope.activeTab, 'at', new Date().toLocaleTimeString());
    };
    $scope.testTabPersistence = function() {
      console.log('=== MANUAL TAB PERSISTENCE TEST ===');
      console.log('Current activeTab:', $scope.activeTab);
      console.log('localStorage value:', localStorage.getItem('webinar-details-active-tab'));
      
      // Test setting and getting
      localStorage.setItem('webinar-details-active-tab', 'messages');
      console.log('Set to messages, now getting:', localStorage.getItem('webinar-details-active-tab'));
      
      // Restore
      $scope.restoreTabFromStorage();
    };
    
    // Make test function available globally for browser console testing
    window.testTabPersistence = $scope.testTabPersistence;
    
    // Tab persistence function (mainly for manual testing now)
    $scope.restoreTabFromStorage = function() {
      const urlParams = new URLSearchParams($window.location.search);
      const tabFromUrl = urlParams.get('tab');
      const savedTab = localStorage.getItem('webinar-details-active-tab');
      
      console.log('=== MANUAL TAB RESTORATION ===');
      console.log('Current activeTab:', $scope.activeTab);
      console.log('URL tab parameter:', tabFromUrl);
      console.log('Saved tab from localStorage:', savedTab);
      
      const validTabs = ['overview', 'video', 'forms', 'attendees', 'messages', 'analytics', 'settings'];
      
      // Priority: URL parameter > saved tab > current tab
      let targetTab = $scope.activeTab;
      if (tabFromUrl && validTabs.includes(tabFromUrl)) {
        targetTab = tabFromUrl;
        console.log('✓ Would use tab from URL:', targetTab);
      } else if (savedTab && validTabs.includes(savedTab)) {
        targetTab = savedTab;
        console.log('✓ Would use saved tab from localStorage:', targetTab);
      }
      
      if (targetTab !== $scope.activeTab) {
        console.log('📝 Changing activeTab to:', targetTab);
        $scope.activeTab = targetTab;
        if (!$scope.$$phase) {
          $scope.$apply();
        }
      }
      
      console.log('=== END MANUAL TAB RESTORATION ===');
    };
    // Group attendee filters to avoid child-scope shadowing from ng-if
    $scope.attendeeFilters = {
      search: '',
      status: '',
      company: ''
    };
    
    // Form builder
    $scope.newField = {
      type: 'text',
      label: '',
      options: '',
      required: false
    };

    // Modal state for confirming removal of custom fields
    $scope.removeFieldModal = {
      open: false,
      index: null,
      label: ''
    };

    $scope.askRemoveCustomField = function(index) {
      if (!$scope.webinar || !$scope.webinar.customFields || index < 0 || index >= $scope.webinar.customFields.length) return;
      const f = $scope.webinar.customFields[index];
      $scope.removeFieldModal.open = true;
      $scope.removeFieldModal.index = index;
      $scope.removeFieldModal.label = f.label || 'this field';
    };

    $scope.cancelRemoveCustomField = function() {
      $scope.removeFieldModal.open = false;
      $scope.removeFieldModal.index = null;
      $scope.removeFieldModal.label = '';
    };

    $scope.confirmRemoveCustomField = function() {
      const idx = $scope.removeFieldModal.index;
      if ($scope.webinar && Array.isArray($scope.webinar.customFields) && idx != null && idx >= 0 && idx < $scope.webinar.customFields.length) {
        const field = $scope.webinar.customFields[idx];
        $scope.webinar.customFields.splice(idx, 1);
        ToastService.success(`Removed custom field: ${field.label}`);
        $scope.saveFormSettings();
      }
      $scope.cancelRemoveCustomField();
    };
    
    // Edit form data
    $scope.editForm = {
      title: '',
      description: '',
      scheduledDateTime: '',
      duration: 60,
      maxAttendees: 100,
      requireRegistration: true
    };
    
    // Load webinar details
    $scope.loadWebinar = function() {
      $scope.isLoading = true;
      $scope.error = null;
      
      // Test localStorage functionality first
      try {
        const testKey = 'webinar-test-' + Date.now();
        const testValue = 'test-value';
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        console.log('✓ localStorage test passed - wrote:', testValue, 'retrieved:', retrieved);
        
        // Show current saved tab for debugging
        const currentSavedTab = localStorage.getItem('webinar-details-active-tab');
        console.log('🔍 Current saved tab in localStorage:', currentSavedTab);
      } catch (e) {
        console.error('❌ localStorage test failed:', e);
      }
      
      $http.get('/api/webinars/' + webinarId)
        .then((response) => {
          $scope.webinar = response.data;
          $scope.isLoading = false;
          
          console.log('Webinar loaded, initializing forms...');
          
          // Load scheduled messages properly
          $scope.loadScheduledMessages();
          
          // Initialize edit form
          $scope.initializeEditForm();
          
          // Initialize custom fields array for dynamic attendees columns
          if (!$scope.webinar.customFields) {
            $scope.webinar.customFields = [];
          }
          
          // Load attendees
          $scope.loadAttendees();
          
          // Update analytics
          $scope.updateAnalytics();
          
          // Re-initialize edit form after delay
          $timeout(function() {
            console.log('Re-initializing edit form after delay...');
            $scope.initializeEditForm();
          }, 500);
          
          // Log completion - tab was already restored immediately on init
          console.log('✅ Webinar data loading complete. ActiveTab:', $scope.activeTab);
        })
        .catch((error) => {
          console.error('Error loading webinar:', error);
          $scope.isLoading = false;
          
          if (error.status === 404) {
            $scope.error = 'This webinar could not be found. It may have been deleted.';
          } else if (error.status === 403) {
            $scope.error = 'You do not have permission to view this webinar.';
          } else {
            $scope.error = 'Unable to load webinar details. Please try again later.';
          }
        });
    };
    
    // Initialize edit form with webinar data
    $scope.initializeEditForm = function() {
      if (!$scope.webinar) {
        console.warn('Cannot initialize edit form: no webinar data');
        return;
      }
      
      console.log('Initializing edit form with webinar:', $scope.webinar);
      
      // Handle nested webinar object structure (response.data vs response.data.webinar)
      const webinarData = $scope.webinar.webinar || $scope.webinar;
      console.log('Using webinar data:', webinarData);
      
      // Use Date object for datetime-local ng-model (AngularJS expects a Date for date/datetime inputs)
      const originalDate = webinarData.scheduledDate;
      console.log('Original scheduled date:', originalDate);
      
      let scheduledDateTime;
      try {
        let date;
        
        // Handle if originalDate is already a Date object or a string
        if (originalDate instanceof Date) {
          date = originalDate;
        } else {
          date = new Date(originalDate);
        }
        
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
        
        // Assign Date object directly to the model
        scheduledDateTime = date;
      } catch (error) {
        console.error('Date formatting error:', error);
        // Fallback to current date (Date object)
        scheduledDateTime = new Date();
      }
      
      $scope.editForm = {
        title: webinarData.title || '',
        description: webinarData.description || '',
        scheduledDateTime: scheduledDateTime,
        duration: webinarData.duration || 60,
        maxAttendees: webinarData.maxAttendees || 100,
        requireRegistration: webinarData.requireRegistration !== false
      };
      
      console.log('Edit form initialized:', $scope.editForm);
      
      // Force scope update
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    };
    
    // Load attendees
    $scope.loadAttendees = function() {
      $http.get('/api/webinars/' + webinarId + '/attendees')
        .then((response) => {
          $scope.attendees = response.data.attendees || [];
          $scope.filterAttendees();
          // Recompute dynamic custom field columns when attendees load
          $scope.computeCustomFieldColumns();
          
          // Update analytics when attendees data changes
          $scope.updateAnalytics();
        })
        .catch((error) => {
          console.error('Error loading attendees:', error);
          $scope.attendees = [];
        });
    };

    // Helper: detect UUID v4-ish strings
    function isUUID(str) {
      return typeof str === 'string' && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(str);
    }

    // Compute the set of custom field column labels to display:
    // - Start with current webinar.customFields labels in their configured order
    // - Add any additional labels found in attendees' customFields (excluding UUID-like keys)
    $scope.computeCustomFieldColumns = function() {
      const labels = [];
      const labelSet = new Set();
      try {
        // Current configured fields first (preserve order)
        const current = ($scope.webinar && Array.isArray($scope.webinar.customFields)) ? $scope.webinar.customFields : [];
        current.forEach(f => {
          const lbl = (f && f.label) ? String(f.label) : '';
          if (lbl && !labelSet.has(lbl)) {
            labelSet.add(lbl);
            labels.push(lbl);
          }
        });
        // Add historical labels from attendees' stored data
        ($scope.attendees || []).forEach(a => {
          const cf = a && a.customFields ? a.customFields : {};
          Object.keys(cf).forEach(k => {
            const key = String(k);
            if (!key) return;
            // Skip UUID-like keys to avoid duplicate id columns when label is present
            if (isUUID(key)) return;
            if (!labelSet.has(key)) {
              labelSet.add(key);
              labels.push(key);
            }
          });
        });
      } catch (e) {
        // No-op on errors, keep current labels
      }
      $scope.customFieldColumns = labels;
    };
    
    // Filter attendees based on search
    $scope.filterAttendees = function() {
      const search = ($scope.attendeeFilters.search || '').toLowerCase().trim();
      const statusFilter = ($scope.attendeeFilters.status || '').toLowerCase();
      const companyFilter = ($scope.attendeeFilters.company || '').toLowerCase();

      $scope.filteredAttendees = ($scope.attendees || []).filter(attendee => {
        // Status filter
        if (statusFilter && (attendee.status || '').toLowerCase() !== statusFilter) return false;
        // Company filter
        if (companyFilter && (attendee.company || '').toLowerCase().indexOf(companyFilter) === -1) return false;
        // Text search across name, email, company and custom fields
        if (!search) return true;
        // Build date strings for "Registered" column search
        let regDisplay = '';
        let regGB = '';
        let regISO = '';
        if (attendee.registeredAt) {
          try {
            const d = new Date(attendee.registeredAt);
            regDisplay = ($scope.formatDateTime ? $scope.formatDateTime(attendee.registeredAt) : d.toString()).toLowerCase();
            regGB = d.toLocaleDateString('en-GB').toLowerCase(); // dd/mm/yyyy
            regISO = d.toISOString().slice(0, 10); // yyyy-mm-dd
          } catch (e) { /* ignore date parse errors */ }
        }

        const baseMatch = (attendee.name || '').toLowerCase().includes(search) ||
                          (attendee.email || '').toLowerCase().includes(search) ||
                          (attendee.company || '').toLowerCase().includes(search) ||
                          (regDisplay && regDisplay.includes(search)) ||
                          (regGB && regGB.includes(search)) ||
                          (regISO && regISO.includes(search));
        if (baseMatch) return true;
        const cf = attendee.customFields || {};
        return Object.keys(cf).some(label => {
          const val = (cf[label] || '').toString().toLowerCase();
          return label.toLowerCase().includes(search) || val.includes(search);
        });
      });
    };

    // Recompute columns when filters or data change as needed
    $scope.$watch('webinar.customFields', function() {
      $scope.computeCustomFieldColumns();
    }, true);
    $scope.$watch('attendees', function() {
      $scope.computeCustomFieldColumns();
    }, true);
    
    // Watch search input (watch nested properties explicitly)
    $scope.$watchGroup(['attendeeFilters.search', 'attendeeFilters.status', 'attendeeFilters.company'], function() {
      $scope.filterAttendees();
    });
    
    // Format date and time for display
    $scope.formatDateTime = function(dateString) {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      const dateOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      };
      const timeOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      
      return date.toLocaleDateString('en-US', dateOptions) + ' at ' + 
             date.toLocaleTimeString('en-US', timeOptions);
    };
    
    // Format file size
    $scope.formatFileSize = function(bytes) {
      if (!bytes) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    
    // Get join URL
    $scope.getJoinUrl = function() {
      return $window.location.origin + '/join/' + webinarId;
    };
    
    // Copy webinar join link
    $scope.copyWebinarLink = function() {
      const joinUrl = $scope.getJoinUrl();
      
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
    
    // Edit webinar (switch to settings tab) - ensure Date object for datetime-local
    $scope.editWebinar = function() {
      console.log('editWebinar called - switching to settings tab');
      $scope.activeTab = 'settings';
      // Save this tab change to localStorage too
      localStorage.setItem('webinar-details-active-tab', 'settings');
      // Defer to allow tab content to render, then initialize form using Date object
      $timeout(function() {
        $scope.initializeEditForm();
      }, 0);
    };
    
    // Update webinar
    $scope.updateWebinar = function() {
      if (!$scope.editForm.title || !$scope.editForm.description || !$scope.editForm.scheduledDateTime) {
        ToastService.error('Please fill in all required fields');
        return;
      }
      
      $scope.isUpdating = true;
      
      try {
        // Create date object from datetime-local input
  const model = $scope.editForm.scheduledDateTime;
  const scheduledDate = (model instanceof Date) ? model : new Date(model);
        
        if (isNaN(scheduledDate.getTime())) {
          throw new Error('Invalid date format');
        }
        
        const updateData = {
          title: $scope.editForm.title.trim(),
          description: $scope.editForm.description.trim(),
          scheduledDate: scheduledDate.toISOString(),
          duration: parseInt($scope.editForm.duration) || 60,
          maxAttendees: parseInt($scope.editForm.maxAttendees) || 100,
          requireRegistration: $scope.editForm.requireRegistration !== false
        };
        
        $http.put('/api/webinars/' + webinarId, updateData)
          .then((response) => {
            ToastService.success('Webinar updated successfully!');
            // Handle nested response structure - use the webinar data directly
            $scope.webinar = response.data.webinar || response.data;
            $scope.isUpdating = false;
            
            // Re-initialize the form with updated data to prevent form clearing
            $timeout(function() {
              $scope.initializeEditForm();
            }, 100);
          })
          .catch((error) => {
            console.error('Error updating webinar:', error);
            ToastService.error('Failed to update webinar. Please try again.');
            $scope.isUpdating = false;
          });
          
      } catch (error) {
        console.error('Date validation error:', error);
        ToastService.error('Invalid date or time. Please check your input.');
        $scope.isUpdating = false;
      }
    };
    
    // Reset edit form
    $scope.resetEditForm = function() {
      $scope.initializeEditForm();
      ToastService.info('Form reset to original values');
    };
    
    // Video upload functions
    $scope.onVideoSelect = function(files) {
      if (!files || files.length === 0) return;
      
      const file = files[0];
      
      // Validate file type
      if (!file.type.startsWith('video/')) {
        ToastService.error('Please select a valid video file');
        return;
      }
      
      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024; // 500MB in bytes
      if (file.size > maxSize) {
        ToastService.error('Video file is too large. Maximum size is 500MB');
        return;
      }
      
      $scope.uploadVideo(file);
    };
    
    $scope.uploadVideo = function(file) {
      $scope.uploadProgress = { percent: 0, uploading: true };
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('video', file);
      
      // Upload with progress tracking
      $http.post('/api/videos/upload/' + webinarId, formData, {
        transformRequest: angular.identity,
        headers: { 'Content-Type': undefined },
        uploadEventHandlers: {
          progress: function(e) {
            if (e.lengthComputable) {
              $scope.$apply(function() {
                $scope.uploadProgress.percent = Math.round((e.loaded / e.total) * 100);
              });
            }
          }
        }
      })
      .then((response) => {
        console.log('Video uploaded successfully:', response.data);
        ToastService.success('Video uploaded successfully!');
        
        // Update webinar with video info
        $scope.webinar = response.data.webinar;
        $scope.uploadProgress = null;
      })
      .catch((error) => {
        console.error('Error uploading video:', error);
        ToastService.error(error.data?.error || 'Failed to upload video. Please try again.');
        $scope.uploadProgress = null;
      });
    };
    
    $scope.removeVideo = function() {
      if (!confirm('Are you sure you want to remove this video?')) {
        return;
      }
      
      $http.delete('/api/videos/' + webinarId)
        .then((response) => {
          console.log('Video removed successfully:', response.data);
          ToastService.success('Video removed successfully!');
          
          // Update webinar to remove video info
          $scope.webinar = response.data.webinar;
        })
        .catch((error) => {
          console.error('Error removing video:', error);
          ToastService.error(error.data?.error || 'Failed to remove video. Please try again.');
        });
    };
    
    // Get video URL for preview
    $scope.getVideoUrl = function(videoFile) {
      if (!videoFile) {
        console.warn('No video file provided');
        return '';
      }
      
      // Get current domain
      const currentDomain = $window.location.origin;
      
      let videoUrl = '';
      
      // Check if video file has path property (newer format)
      if (videoFile.path) {
        videoUrl = currentDomain + '/' + videoFile.path;
      } else if (videoFile.filename) {
        // Fallback to filename (older format)
        videoUrl = currentDomain + '/uploads/' + videoFile.filename;
      } else {
        console.warn('No valid video path or filename found');
        return '';
      }
      
      console.log('Generated video URL with domain:', videoUrl, 'for file:', videoFile);
      return videoUrl;
    };
    
    // Navigation function for dashboard
    $scope.goToDashboard = function() {
      try {
        console.log('Attempting to navigate to dashboard...');
        // Check if user is authenticated as host
        if (AuthService.isHost()) {
          $state.go('dashboard');
        } else {
          console.log('User not authenticated as host, redirecting to home');
          $state.go('home');
        }
      } catch (error) {
        console.error('State navigation error:', error);
        // Fallback to direct navigation
        console.log('Using fallback navigation');
        $window.location.href = '/dashboard';
      }
    };
    
    // Handle video events
    $scope.onVideoLoad = function() {
      console.log('Video loaded successfully');
    };
    
    $scope.onVideoError = function(event) {
      console.error('Video error:', event);
      ToastService.error('Unable to load video preview. Please check if the video file exists.');
    };
    
    $scope.onVideoCanPlay = function() {
      console.log('Video can play');
    };
    
    // Format file size
    $scope.formatFileSize = function(bytes) {
      if (!bytes) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    
    // Format date time
    $scope.formatDateTime = function(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
    };
    
    // Get video stream URL
    $scope.getVideoStreamUrl = function() {
      if (!$scope.webinar || !$scope.webinar.videoFile) return null;
      return '/api/videos/' + webinarId + '/stream';
    };
    
    // Export attendees to CSV
    $scope.exportAttendees = function() {
      if ($scope.attendees.length === 0) {
        ToastService.error('No attendees to export');
        return;
      }
      
      // Determine all custom field labels across attendees to create columns
      const allLabelsSet = new Set();
      ($scope.attendees || []).forEach(a => {
        Object.keys(a.customFields || {}).forEach(l => allLabelsSet.add(l));
      });
      const customLabels = Array.from(allLabelsSet);
      // Create CSV content with custom fields
      const headers = ['Name', 'Email', 'Company', 'Registered At', 'Status', ...customLabels];
      const csvContent = [
        headers.join(','),
        ...$scope.attendees.map(attendee => {
          const row = [
            `"${attendee.name || ''}"`,
            `"${attendee.email || ''}"`,
            `"${attendee.company || ''}"`,
            `"${$scope.formatDateTime(attendee.registeredAt) || ''}"`,
            `"${attendee.status || ''}"`
          ];
          customLabels.forEach(label => {
            const val = (attendee.customFields && attendee.customFields[label] !== undefined) ? attendee.customFields[label] : '';
            row.push(`"${(val !== null && val !== undefined ? String(val) : '').replace(/"/g, '""')}"`);
          });
          return row.join(',');
        })
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${$scope.webinar.title}_attendees.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      ToastService.success('Attendees exported successfully!');
    };
    
    // Form Builder Functions
    $scope.getFieldOptions = function(optionsString) {
      if (!optionsString) return [];
      return optionsString.split('\n').filter(option => option.trim());
    };
    
    $scope.addCustomField = function() {
      if (!$scope.newField.label || !$scope.newField.type) {
        ToastService.error('Please fill in field label and type');
        return;
      }
      
      // Initialize custom fields array if it doesn't exist
      if (!$scope.webinar.customFields) {
        $scope.webinar.customFields = [];
      }
      
      // Create field object
      const field = {
        id: Date.now().toString(), // Simple ID generation
        type: $scope.newField.type,
        label: $scope.newField.label.trim(),
        required: $scope.newField.required || false
      };
      
  // Add options for select/radio/checkbox fields
  if (['select', 'radio', 'checkbox'].includes(field.type) && $scope.newField.options) {
        field.options = $scope.getFieldOptions($scope.newField.options);
        if (field.options.length === 0) {
          ToastService.error('Please provide at least one option');
          return;
        }
      }
      
      // Add field to webinar
      $scope.webinar.customFields.push(field);
      
      // Reset form
      $scope.newField = {
        type: 'text',
        label: '',
        options: '',
        required: false
      };
      
      ToastService.success('Custom field added successfully!');
      
      // Auto-save
      $scope.saveFormSettings();
    };
    
    $scope.removeCustomField = function(index) {
      if (!$scope.webinar.customFields || index < 0 || index >= $scope.webinar.customFields.length) {
        return;
      }
      
  const field = $scope.webinar.customFields[index];
  // Remove immediately; no blocking browser confirm dialogs
  $scope.webinar.customFields.splice(index, 1);
  ToastService.info(`Removed custom field: ${field.label}`);
      
  // Auto-save
  $scope.saveFormSettings();
    };
    
    $scope.saveFormSettings = function() {
      $scope.isUpdating = true;
      
      const updateData = {
        customFields: $scope.webinar.customFields || [],
        confirmationMessage: $scope.webinar.confirmationMessage || '',
        registrationDeadline: $scope.webinar.registrationDeadline || null
      };
      
      $http.put('/api/webinars/' + webinarId, updateData)
        .then((response) => {
          ToastService.success('Form settings saved successfully!');
          $scope.webinar = response.data && response.data.webinar ? response.data.webinar : response.data;
          $scope.isUpdating = false;
          // Ensure custom fields array exists
          if (!$scope.webinar.customFields) $scope.webinar.customFields = [];
          // Recompute columns after save
          $scope.computeCustomFieldColumns();
        })
        .catch((error) => {
          console.error('Error saving form settings:', error);
          ToastService.error('Failed to save form settings. Please try again.');
          $scope.isUpdating = false;
        });
    };
    
    // Analytics Variables (computed once to avoid infinite digest)
    $scope.analytics = {
      daysUntilWebinar: 0,
      avgDailyRegistrations: 0,
      registrationTimeline: [],
      maxDailyRegistrations: 1,
      topCompanies: []
    };
    
    // Compute analytics data
    $scope.updateAnalytics = function() {
      if (!$scope.webinar) return;
      
      // Days until webinar
      if ($scope.webinar.scheduledDate) {
        const now = new Date();
        const webinarDate = new Date($scope.webinar.scheduledDate);
        const diffTime = webinarDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        $scope.analytics.daysUntilWebinar = Math.max(0, diffDays);
      }
      
      if ($scope.attendees && $scope.attendees.length > 0) {
        // Average daily registrations
        const now = new Date();
        const createdDate = new Date($scope.webinar.createdAt);
        const daysSinceCreated = Math.max(1, Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24)));
        $scope.analytics.avgDailyRegistrations = Math.round($scope.attendees.length / daysSinceCreated * 10) / 10;
        
        // Registration timeline
        const timeline = {};
        $scope.attendees.forEach(attendee => {
          const date = new Date(attendee.registeredAt);
          const dateKey = date.toDateString();
          
          if (!timeline[dateKey]) {
            timeline[dateKey] = {
              date: date,
              count: 0
            };
          }
          timeline[dateKey].count++;
        });
        $scope.analytics.registrationTimeline = Object.values(timeline);
        
        // Max daily registrations
        $scope.analytics.maxDailyRegistrations = $scope.analytics.registrationTimeline.length > 0 
          ? Math.max(...$scope.analytics.registrationTimeline.map(day => day.count))
          : 1;
        
        // Top companies
        const companies = {};
        $scope.attendees.forEach(attendee => {
          const company = attendee.company || 'Not specified';
          companies[company] = (companies[company] || 0) + 1;
        });
        
        $scope.analytics.topCompanies = Object.entries(companies)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      } else {
        $scope.analytics.avgDailyRegistrations = 0;
        $scope.analytics.registrationTimeline = [];
        $scope.analytics.maxDailyRegistrations = 1;
        $scope.analytics.topCompanies = [];
      }
    };
    
    // Legacy functions kept for compatibility but now just return computed values
    $scope.getDaysUntilWebinar = function() {
      return $scope.analytics.daysUntilWebinar;
    };
    
    $scope.getAvgDailyRegistrations = function() {
      return $scope.analytics.avgDailyRegistrations;
    };
    
    $scope.getRegistrationTimeline = function() {
      return $scope.analytics.registrationTimeline;
    };
    
    $scope.getMaxDailyRegistrations = function() {
      return $scope.analytics.maxDailyRegistrations;
    };
    
    $scope.getTopCompanies = function() {
      return $scope.analytics.topCompanies;
    };
    
    $scope.getRegistrationsByStatus = function(status) {
      if (!$scope.attendees) return 0;
      return $scope.attendees.filter(attendee => attendee.status === status).length;
    };
    
    // Logout function
    $scope.logout = function() {
      AuthService.logout();
      $state.go('home');
    };
    
    // Watch for webinar data changes
    $scope.$watch('webinar', function(newWebinar, oldWebinar) {
      if (newWebinar && newWebinar !== oldWebinar) {
        console.log('Webinar data changed, reinitializing edit form');
        $scope.initializeEditForm();
      }
    });
    
    // Watch for tab changes to reinitialize forms
    $scope.$watch('activeTab', function(newTab, oldTab) {
      console.log('🔍🔍🔍 TAB WATCHER TRIGGERED 🔍🔍🔍');
      console.log('oldTab:', oldTab, 'newTab:', newTab);
      console.log('Type of oldTab:', typeof oldTab, 'Type of newTab:', typeof newTab);
      console.log('oldTab === undefined:', oldTab === undefined);
      console.log('newTab !== oldTab:', newTab !== oldTab);
      console.log('Current timestamp:', new Date().toLocaleTimeString());
      
      if (newTab && newTab !== oldTab && oldTab !== undefined) {
        console.log('🏆 SAVING TAB TO localStorage');
        console.log('📝 Tab changed from', oldTab, 'to', newTab, '- saving to localStorage');
        
        // Save current tab to localStorage for persistence
        // Only save if this is a user-initiated change (not initialization)
        try {
          console.log('📦 Attempting to save to localStorage...');
          localStorage.setItem('webinar-details-active-tab', newTab);
          const verifyRead = localStorage.getItem('webinar-details-active-tab');
          console.log('✅ Successfully saved tab to localStorage:', newTab);
          console.log('✅ Verification read from localStorage:', verifyRead);
          console.log('✅ Save successful:', verifyRead === newTab);
        } catch (e) {
          console.error('❌ Failed to save tab to localStorage:', e);
        }
      } else {
        console.log('❌ NOT saving to localStorage because:');
        if (!newTab) console.log('  - newTab is falsy:', newTab);
        if (newTab === oldTab) console.log('  - newTab === oldTab');
        if (oldTab === undefined) console.log('  - oldTab is undefined (initialization)');
      }
      
      if (newTab === 'settings' && $scope.webinar && newTab !== oldTab) {
        console.log('🔧 Switching to settings tab, reinitializing edit form');
        $timeout(function() {
          $scope.initializeEditForm();
        }, 100);
      }
      if (newTab === 'messages' && $scope.webinar && newTab !== oldTab) {
        console.log('💬 Switching to messages tab, loading scheduled messages');
        $scope.loadScheduledMessages();
      }
      
      console.log('🔍🔍🔍 TAB WATCHER END 🔍🔍🔍');
    });
    
    // =============== AUTOMATED MESSAGES SCHEDULER ===============
    
    // Load scheduled messages for this webinar
    $scope.loadScheduledMessages = function() {
      console.log('=== LOADING SCHEDULED MESSAGES ===');
      console.log('Raw webinar.scheduledMessages:', $scope.webinar.scheduledMessages);
      
      $scope.scheduledMessages = ($scope.webinar.scheduledMessages || [])
        .sort((a, b) => (a.atSeconds || 0) - (b.atSeconds || 0)); // Sort by time ascending
      
      // Debug: Log all messages and their types BEFORE processing
      console.log('Messages before processing:', $scope.scheduledMessages.map(m => ({ 
        id: m.id, 
        type: m.type,
        kind: m.kind,
        text: m.text ? m.text.substring(0, 50) + '...' : 'no text',
        imageUrl: m.imageUrl,
        buttons: m.buttons
      })));
      
      // Ensure message types are preserved and properly set
      $scope.scheduledMessages.forEach(function(message, index) {
        console.log(`Processing message ${index}:`, {
          id: message.id,
          originalType: message.type,
          originalKind: message.kind,
          hasType: !!message.type,
          hasKind: !!message.kind
        });
        
        // Map 'kind' field from server to 'type' field for frontend
        if (message.kind && !message.type) {
          console.log(`Mapping kind '${message.kind}' to type for message ${message.id}`);
          message.type = message.kind;
        }
        
        // Ensure type is set, default to 'text' if not specified
        if (!message.type) {
          console.warn(`Message ${message.id} has no type, defaulting to 'text'`);
          message.type = 'text';
        }
        
        // Convert atSeconds to hours/minutes/seconds for editing
        if (typeof message.atSeconds === 'number') {
          message.hours = Math.floor(message.atSeconds / 3600);
          message.minutes = Math.floor((message.atSeconds % 3600) / 60);
          message.seconds = message.atSeconds % 60;
        } else {
          message.hours = 0;
          message.minutes = 0;
          message.seconds = 0;
          message.atSeconds = 0;
        }
        
        console.log(`Message ${index} after processing:`, {
          id: message.id,
          type: message.type,
          kind: message.kind,
          hours: message.hours,
          minutes: message.minutes,
          seconds: message.seconds
        });
      });
      
      // Debug: Log all messages and their types AFTER processing
      console.log('Messages after processing:', $scope.scheduledMessages.map(m => ({ 
        id: m.id, 
        type: m.type, 
        kind: m.kind,
        text: m.text ? m.text.substring(0, 30) + '...' : 'no text'
      })));
      
      // Force scope update to refresh UI
      console.log('Forcing scope update...');
      if (!$scope.$$phase) {
        $scope.$apply();
      }
      console.log('=== FINISHED LOADING SCHEDULED MESSAGES ===');
    };
    
    // Update atSeconds when time components change
    $scope.updateMessageTime = function(message) {
      const hours = parseInt(message.hours) || 0;
      const minutes = parseInt(message.minutes) || 0;
      const seconds = parseInt(message.seconds) || 0;
      message.atSeconds = hours * 3600 + minutes * 60 + seconds;
    };
    
    // Open message scheduler popup with video preview
    $scope.openMessageScheduler = function() {
      $scope.messageScheduler.open = true;
      
      // Ensure scheduled messages have time components and proper structure
      const messagesWithTimeComponents = ($scope.scheduledMessages || []).map(m => {
        const message = { ...m };
        
        // Debug: Log original message
        console.log('Original message:', JSON.stringify(m, null, 2));
        
        // Convert atSeconds to hours/minutes/seconds if not already present
        if (typeof message.atSeconds === 'number' && (message.hours === undefined || message.minutes === undefined || message.seconds === undefined)) {
          message.hours = Math.floor(message.atSeconds / 3600);
          message.minutes = Math.floor((message.atSeconds % 3600) / 60);
          message.seconds = message.atSeconds % 60;
        } else if (message.hours === undefined || message.minutes === undefined || message.seconds === undefined) {
          message.hours = 0;
          message.minutes = 0;
          message.seconds = 0;
          message.atSeconds = 0;
        }
        
        // Ensure buttons array exists for CTA messages
        if (message.type === 'cta' && !Array.isArray(message.buttons)) {
          message.buttons = message.buttons ? [message.buttons] : [];
        }
        
        // Ensure required fields exist with defaults
        message.text = message.text || '';
        message.type = message.type || 'text';
        message.id = message.id || $scope.generateMessageId();
        
        // Debug: Log processed message
        console.log('Processed message:', JSON.stringify(message, null, 2));
        
        return message;
      });
      
      $scope.messageScheduler.editing = messagesWithTimeComponents;
      
      // Debug: Log final editing array
      console.log('Final editing array:', JSON.stringify($scope.messageScheduler.editing, null, 2));
      
      // Set video URL if available
      if ($scope.webinar && $scope.webinar.videoPath) {
        const videoPath = $scope.webinar.videoPath;
        if (videoPath.startsWith('http')) {
          $scope.messageScheduler.videoUrl = videoPath;
        } else {
          $scope.messageScheduler.videoUrl = window.location.origin + videoPath;
        }
      }
      
      // Initialize video when modal opens
      $timeout(function() {
        const video = document.getElementById('schedulerVideo');
        if (video) {
          video.load();
        }
      }, 100);
    };
    
    // Close message scheduler
    $scope.closeMessageScheduler = function() {
      $scope.messageScheduler.open = false;
    };
    
    // Edit single message - opens scheduler with only that message
    $scope.editSingleMessage = function(message) {
      if (!message) return;
      
      console.log('Editing single message:', JSON.stringify(message, null, 2));
      
      // Create a deep copy of the message with time components
      const messageToEdit = JSON.parse(JSON.stringify(message));
      
      // Convert atSeconds to hours/minutes/seconds for editing
      if (typeof messageToEdit.atSeconds === 'number') {
        messageToEdit.hours = Math.floor(messageToEdit.atSeconds / 3600);
        messageToEdit.minutes = Math.floor((messageToEdit.atSeconds % 3600) / 60);
        messageToEdit.seconds = messageToEdit.atSeconds % 60;
      } else {
        messageToEdit.hours = 0;
        messageToEdit.minutes = 0;
        messageToEdit.seconds = 0;
        messageToEdit.atSeconds = 0;
      }
      
      // Ensure proper structure for different message types
      messageToEdit.type = messageToEdit.type || 'text';
      messageToEdit.text = messageToEdit.text || '';
      messageToEdit.id = messageToEdit.id || $scope.generateMessageId();
      
      // Ensure proper structure for CTA buttons
      if (messageToEdit.type === 'cta') {
        messageToEdit.buttons = Array.isArray(messageToEdit.buttons) ? messageToEdit.buttons : [];
        if (messageToEdit.buttons.length === 0) {
          messageToEdit.buttons.push({ label: 'Button', url: 'https://example.com' });
        }
      }
      
      // Ensure proper structure for image messages
      if (messageToEdit.type === 'image') {
        messageToEdit.imageUrl = messageToEdit.imageUrl || '';
        messageToEdit.caption = messageToEdit.caption || '';
      }
      
      console.log('Message prepared for editing:', JSON.stringify(messageToEdit, null, 2));
      
      // Open scheduler with this single message
      $scope.messageScheduler.open = true;
      $scope.messageScheduler.editing = [messageToEdit];
      
      // Force angular to update the view
      $timeout(function() {
        $scope.$apply();
      }, 50);
      
      // Set video URL if available
      if ($scope.webinar && $scope.webinar.videoPath) {
        const videoPath = $scope.webinar.videoPath;
        if (videoPath.startsWith('http')) {
          $scope.messageScheduler.videoUrl = videoPath;
        } else {
          $scope.messageScheduler.videoUrl = window.location.origin + videoPath;
        }
      }
      
      // Initialize video when modal opens
      $timeout(function() {
        const video = document.getElementById('schedulerVideo');
        if (video) {
          video.load();
        }
      }, 100);
    };
    
    // Delete single message
    $scope.deleteSingleMessage = function(messageId) {
      if (!messageId) return;
      
      // Set up delete confirmation
      $scope.deleteConfirmation = {
        open: true,
        messageId: messageId,
        title: 'Delete Automated Message',
        message: 'Are you sure you want to delete this automated message? This action cannot be undone.'
      };
    };
    
    // Confirm delete message
    $scope.confirmDeleteMessage = function() {
      const messageId = $scope.deleteConfirmation.messageId;
      
      // Remove from local array
      $scope.scheduledMessages = $scope.scheduledMessages.filter(m => m.id !== messageId);
      $scope.webinar.scheduledMessages = $scope.scheduledMessages;
      
      // Save to server
      $http.put('/api/webinars/' + webinarId + '/scheduled-messages', { 
        scheduledMessages: $scope.scheduledMessages 
      })
      .then(function(response) {
        ToastService.success('Message deleted successfully!');
      })
      .catch(function(error) {
        console.error('Error deleting message:', error);
        ToastService.error('Failed to delete message');
        // Reload messages on error
        $scope.loadScheduledMessages();
      });
      
      // Close confirmation dialog
      $scope.deleteConfirmation.open = false;
    };
    
    // Cancel delete message
    $scope.cancelDeleteMessage = function() {
      $scope.deleteConfirmation.open = false;
    };
    
    // Get current video time for scheduling
    $scope.getCurrentVideoTime = function() {
      try {
        const video = document.getElementById('schedulerVideo');
        if (video && !isNaN(video.currentTime)) {
          return Math.floor(video.currentTime);
        }
      } catch (e) {}
      return 0;
    };
    
    // Generate unique ID for scheduled messages
    $scope.generateMessageId = function() {
      return 'msg_' + Math.random().toString(36).slice(2) + Date.now();
    };
    
    // Add text message at current time
    $scope.addTextMessage = function() {
      const currentTime = $scope.getCurrentVideoTime();
      const hours = Math.floor(currentTime / 3600);
      const minutes = Math.floor((currentTime % 3600) / 60);
      const seconds = currentTime % 60;
      
      $scope.messageScheduler.editing.push({
        id: $scope.generateMessageId(),
        type: 'text',
        text: 'New message',
        atSeconds: currentTime,
        hours: hours,
        minutes: minutes,
        seconds: seconds
      });
    };
    
    // Add CTA message at current time
    $scope.addCTAMessage = function() {
      const currentTime = $scope.getCurrentVideoTime();
      const hours = Math.floor(currentTime / 3600);
      const minutes = Math.floor((currentTime % 3600) / 60);
      const seconds = currentTime % 60;
      
      $scope.messageScheduler.editing.push({
        id: $scope.generateMessageId(),
        type: 'cta',
        text: 'Limited time offer!',
        buttons: [{ label: 'Buy Now', url: 'https://example.com' }],
        atSeconds: currentTime,
        hours: hours,
        minutes: minutes,
        seconds: seconds
      });
    };
    
    // Add image message at current time
    $scope.addImageMessage = function() {
      const currentTime = $scope.getCurrentVideoTime();
      const hours = Math.floor(currentTime / 3600);
      const minutes = Math.floor((currentTime % 3600) / 60);
      const seconds = currentTime % 60;
      
      $scope.messageScheduler.editing.push({
        id: $scope.generateMessageId(),
        type: 'image',
        imageUrl: '',
        caption: 'Check this out!',
        atSeconds: currentTime,
        hours: hours,
        minutes: minutes,
        seconds: seconds
      });
    };
    
    // Remove scheduled message
    $scope.removeScheduledMessage = function(id) {
      $scope.messageScheduler.editing = $scope.messageScheduler.editing.filter(m => m.id !== id);
    };
    
    // Add button to CTA message
    $scope.addCTAButton = function(message) {
      if (!message.buttons) {
        message.buttons = [];
      }
      message.buttons.push({ label: 'New Button', url: 'https://example.com' });
    };
    
    // Remove button from CTA message
    $scope.removeCTAButton = function(message, index) {
      if (message.buttons && index >= 0 && index < message.buttons.length) {
        message.buttons.splice(index, 1);
      }
    };
    
    // Save scheduled messages
    $scope.saveScheduledMessages = function() {
      if (!$scope.webinar) return;
      
      $scope.messageScheduler.saving = true;
      
      // Normalize and validate messages
      const validMessages = $scope.messageScheduler.editing
        .filter(m => {
          if (!m || !m.type) return false;
          // For image messages, require either text/caption or imageUrl
          if (m.type === 'image') {
            return (m.text && m.text.trim()) || (m.caption && m.caption.trim()) || (m.imageUrl && m.imageUrl.trim());
          }
          // For text and CTA messages, require text
          return m.text && m.text.trim();
        })
        .map(m => {
          // Debug: log the original message
          console.log('Processing message for save:', JSON.stringify(m, null, 2));
          
          // Calculate atSeconds from hours/minutes/seconds if they exist
          const hours = parseInt(m.hours) || 0;
          const minutes = parseInt(m.minutes) || 0;
          const seconds = parseInt(m.seconds) || 0;
          const calculatedSeconds = hours * 3600 + minutes * 60 + seconds;
          
          const message = {
            id: m.id || $scope.generateMessageId(),
            type: m.type || 'text', // Ensure type is preserved
            atSeconds: Math.max(0, calculatedSeconds || parseInt(m.atSeconds || 0, 10))
          };
          
          // Debug: log message type
          console.log('Message type being saved:', message.type, 'for message ID:', message.id);
          
          // Add type-specific properties
          if (m.type === 'image') {
            message.imageUrl = m.imageUrl ? m.imageUrl.trim() : undefined;
            message.caption = m.caption ? m.caption.trim() : undefined;
            message.text = m.text ? m.text.trim() : (message.caption || '');
          } else if (m.type === 'cta') {
            message.text = m.text.trim();
            message.buttons = Array.isArray(m.buttons) ? 
              m.buttons.filter(b => b && b.label && b.label.trim() && b.url && b.url.trim()) : [];
          } else {
            message.text = m.text.trim();
          }
          
          // Debug: log final message
          console.log('Final processed message:', JSON.stringify(message, null, 2));
          
          return message;
        })
        .sort((a, b) => a.atSeconds - b.atSeconds); // Auto-sort by time ascending
      
      $http.put('/api/webinars/' + webinarId + '/scheduled-messages', { 
        scheduledMessages: validMessages 
      })
      .then(function(response) {
        ToastService.success('Automated messages saved successfully!');
        $scope.scheduledMessages = validMessages;
        $scope.webinar.scheduledMessages = validMessages;
        $scope.messageScheduler.saving = false;
        $scope.messageScheduler.open = false;
      })
      .catch(function(error) {
        console.error('Error saving scheduled messages:', error);
        ToastService.error('Failed to save automated messages');
        $scope.messageScheduler.saving = false;
      });
    };
    
    // Format time display
    $scope.formatTimeDisplay = function(seconds) {
      const totalSecs = parseInt(seconds) || 0;
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      
      if (hours > 0) {
        return hours + 'h ' + mins + 'm ' + secs + 's';
      } else if (mins > 0) {
        return mins + 'm ' + secs + 's';
      } else {
        return secs + 's';
      }
    };
    
    // Parse time input (supports hours, minutes, seconds format)
    $scope.parseTimeInput = function(timeStr) {
      if (!timeStr) return 0;
      
      // Convert "1h 30m 45s" or "30m 45s" or "45s" format to seconds
      const str = String(timeStr).toLowerCase().trim();
      let totalSeconds = 0;
      
      // Extract hours
      const hoursMatch = str.match(/(\d+)h/);
      if (hoursMatch) {
        totalSeconds += parseInt(hoursMatch[1]) * 3600;
      }
      
      // Extract minutes
      const minutesMatch = str.match(/(\d+)m/);
      if (minutesMatch) {
        totalSeconds += parseInt(minutesMatch[1]) * 60;
      }
      
      // Extract seconds
      const secondsMatch = str.match(/(\d+)s/);
      if (secondsMatch) {
        totalSeconds += parseInt(secondsMatch[1]);
      }
      
      // If no time format found, treat as raw seconds
      if (!hoursMatch && !minutesMatch && !secondsMatch) {
        const numValue = parseInt(str);
        if (!isNaN(numValue)) {
          totalSeconds = numValue;
        }
      }
      
      return Math.max(0, totalSeconds);
    };

    // Initialize
    $scope.loadWebinar();
  }
]);
