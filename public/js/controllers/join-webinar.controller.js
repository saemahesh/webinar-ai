// Join Webinar Controller
angular.module('webinarApp')
.controller('JoinWebinarController', ['$scope', '$http', '$stateParams', '$state', 'ToastService', '$window',
  function($scope, $http, $stateParams, $state, ToastService, $window) {
    
    // Get webinar ID from URL
    const webinarId = $stateParams.webinarId;
    
    // Loading states
    $scope.isLoading = true;
    $scope.isRegistering = false;
    $scope.isRegistered = false;
    $scope.isJoining = false;
  $scope.debugMode = false; // Disable debug mode by default
    
    // Data
    $scope.webinar = null;
    $scope.error = null;
    $scope.registrationEmail = null;
    
    // Registration form data
    $scope.registrationData = {
      name: '',
      email: '',
      company: '',
      customFields: {}
    };

    // Compute client-side webinar status based on time window
    function computeClientStatus(webinar) {
      if (!webinar || !webinar.scheduledDate) return webinar && webinar.status ? webinar.status : 'upcoming';
      const start = new Date(webinar.scheduledDate);
      const now = new Date();
      const durationMin = Number.isFinite(Number(webinar.duration)) ? Number(webinar.duration) : 30;
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      if (now < start) return 'upcoming';
      if (now <= end) return 'live';
      return 'completed';
    }
    
    // Load webinar details
    $scope.loadWebinar = function() {
      $scope.isLoading = true;
      $scope.error = null;
      
      $http.get('/api/public/webinars/' + webinarId)
        .then((response) => {
          // console.debug('Full API response:', response.data);
          $scope.webinar = response.data.webinar || response.data;
          $scope.isLoading = false;
          
          // Debug the webinar object structure
          // console.debug('Webinar object:', $scope.webinar);
          // console.debug('Webinar custom fields:', $scope.webinar.customFields);
          
          // Ensure customFields is always an array
          if (!$scope.webinar.customFields) {
            $scope.webinar.customFields = [];
          }
          // Initialize custom fields in registration data with sensible defaults per type
          if (!$scope.registrationData.customFields) {
            $scope.registrationData.customFields = {};
          }
          if ($scope.webinar.customFields && $scope.webinar.customFields.length > 0) {
            $scope.webinar.customFields.forEach(field => {
              var label = field.label;
              if (label == null) return;
              if (field.type === 'checkbox') {
                // Use an array of selected options
                if (!Array.isArray($scope.registrationData.customFields[label])) {
                  $scope.registrationData.customFields[label] = [];
                }
              } else {
                if ($scope.registrationData.customFields[label] == null) {
                  $scope.registrationData.customFields[label] = '';
                }
              }
            });
          }
          
          // Sync status with client-side computation so badge and ended state are consistent
          $scope.webinar.status = computeClientStatus($scope.webinar);

          // Force scope update to ensure UI reflects changes
          if (!$scope.$$phase) {
            $scope.$apply();
          }
          
          // Check if user is already registered
          $scope.checkRegistration();
        })
        .catch((error) => {
          console.error('Error loading webinar:', error);
          $scope.isLoading = false;
          
          if (error.status === 404) {
            $scope.error = 'This webinar could not be found. It may have been deleted or the link is incorrect.';
          } else {
            $scope.error = 'Unable to load webinar details. Please try again later.';
          }
        });
    };
    
    // Check if user is already registered
    $scope.checkRegistration = function() {
      const savedRegistration = localStorage.getItem(`registration_${webinarId}`);
      if (savedRegistration) {
        try {
          const registrationData = JSON.parse(savedRegistration);
          $scope.isRegistered = true;
          $scope.registrationEmail = registrationData.email;
          $scope.registrationData = registrationData; // Restore full registration data
          // console.debug('Found existing registration:', registrationData);
        } catch (e) {
          console.error('Error parsing saved registration:', e);
          // Clear invalid data
          localStorage.removeItem(`registration_${webinarId}`);
        }
      }
    };
    
    // Check if webinar/video has ended based on webinar.duration (minutes)
    $scope.isWebinarEnded = function() {
      if (!$scope.webinar || !$scope.webinar.scheduledDate) {
        return false;
      }
      
      const now = new Date();
      const startTime = new Date($scope.webinar.scheduledDate);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      const durationMinutes = Number.isFinite(Number($scope.webinar.duration)) ? Number($scope.webinar.duration) : 30;
      
      // If webinar started and more than configured duration minutes have passed (video duration)
      const ended = now >= startTime && elapsedMinutes >= durationMinutes;
      return ended || $scope.webinar.status === 'completed';
    };
    
    // Register for webinar
    $scope.registerForWebinar = function() {
      if (!$scope.registrationData.name || !$scope.registrationData.email) {
        ToastService.error('Please fill in all required fields');
        return;
      }
      
  $scope.isRegistering = true;
      
      // Build custom fields payload keyed by both label and ID for robustness
      const combinedCustomFields = {};
      if ($scope.webinar && Array.isArray($scope.webinar.customFields)) {
        $scope.webinar.customFields.forEach(field => {
          const label = field.label;
          const id = field.id;
          let value = $scope.registrationData.customFields ? $scope.registrationData.customFields[label] : undefined;
          // Normalize checkbox values to array of selected options
          if (field.type === 'checkbox') {
            if (Array.isArray(value)) {
              // use as-is
            } else if (value && typeof value === 'object') {
              value = Object.keys(value).filter(k => !!value[k]);
            } else if (typeof value === 'string') {
              value = value ? [value] : [];
            } else if (value === undefined || value === null) {
              value = [];
            }
          }
          if (value !== undefined) {
            combinedCustomFields[label] = value;
            if (id) combinedCustomFields[id] = value;
          }
        });
      } else if ($scope.registrationData && $scope.registrationData.customFields) {
        Object.assign(combinedCustomFields, $scope.registrationData.customFields);
      }

      const registrationPayload = {
        name: $scope.registrationData.name.trim(),
        email: $scope.registrationData.email.trim().toLowerCase(),
        company: ($scope.registrationData.company || '').trim(),
        customFields: combinedCustomFields
      };
      
      $http.post('/api/public/webinars/' + webinarId + '/register', registrationPayload)
        .then((response) => {
          ToastService.success('Registration successful! You will receive a confirmation email shortly.');
          
          // Store full registration in localStorage with consistent key format
          const fullRegistrationData = {
            webinarId: webinarId,
            name: registrationPayload.name,
            email: registrationPayload.email,
            company: registrationPayload.company,
            customFields: registrationPayload.customFields,
            registeredAt: new Date().toISOString()
          };
          
          localStorage.setItem(`registration_${webinarId}`, JSON.stringify(fullRegistrationData));
          // console.debug('Registration saved to localStorage:', fullRegistrationData);
          
          // Update state
          $scope.isRegistered = true;
          $scope.registrationEmail = registrationPayload.email;
          $scope.isRegistering = false;
          
          // Update webinar registration count
          if ($scope.webinar) {
            $scope.webinar.registrations = ($scope.webinar.registrations || 0) + 1;
          }
        })
        .catch((error) => {
          console.error('Error registering for webinar:', error);
          $scope.isRegistering = false;
          
          if (error.status === 409) {
            ToastService.error('You are already registered for this webinar with this email address.');
          } else if (error.status === 400) {
            ToastService.error(error.data.message || 'Invalid registration data. Please check your information.');
          } else {
            ToastService.error('Registration failed. Please try again later.');
          }
        });
    };

    // Toggle selection for checkbox custom fields (stores as array of selected options)
    $scope.toggleCheckbox = function(fieldLabel, option) {
      if (!$scope.registrationData.customFields) $scope.registrationData.customFields = {};
      if (!Array.isArray($scope.registrationData.customFields[fieldLabel])) {
        $scope.registrationData.customFields[fieldLabel] = [];
      }
      const arr = $scope.registrationData.customFields[fieldLabel];
      const idx = arr.indexOf(option);
      if (idx === -1) {
        arr.push(option);
      } else {
        arr.splice(idx, 1);
      }
    };
    
    // Format date for display
    $scope.formatDate = function(dateString) {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      };
      return date.toLocaleDateString('en-US', options);
    };
    
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
    
    // Share webinar on social media
    $scope.shareWebinar = function(platform) {
      if (!$scope.webinar) return;
      
      const webinarUrl = $window.location.href;
      const text = encodeURIComponent(`Join me for "${$scope.webinar.title}" - ${$scope.formatDate($scope.webinar.scheduledDate)}`);
      const url = encodeURIComponent(webinarUrl);
      
      let shareUrl = '';
      
      switch (platform) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
          break;
        case 'linkedin':
          shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
          break;
        default:
          return;
      }
      
      $window.open(shareUrl, '_blank', 'width=600,height=400');
    };
    
    // Copy webinar link
    $scope.copyWebinarLink = function() {
      const url = $window.location.href;
      
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
          ToastService.success('Webinar link copied to clipboard!');
        }).catch(() => {
          $scope.fallbackCopyLink(url);
        });
      } else {
        $scope.fallbackCopyLink(url);
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
        ToastService.success('Webinar link copied to clipboard!');
      } catch (err) {
        ToastService.error('Unable to copy link. Please copy the URL manually.');
      }
      
      document.body.removeChild(textArea);
    };
    
    // Join webinar room
    $scope.joinWebinarRoom = function() {
  // console.debug('Join webinar room clicked', { webinarId, isRegistered: $scope.isRegistered, registrationData: $scope.registrationData });
      
      // Check if webinar/video has ended before allowing entry
      if ($scope.webinar) {
        // Respect either computed status or duration window
        const status = computeClientStatus($scope.webinar);
        if (status === 'completed') {
          // console.debug('Webinar/video has ended - redirecting to ended page instead of room');
          ToastService.info('This webinar has ended. Thank you for your interest!');
          
          // Store ended webinar info
          localStorage.setItem(`ended_webinar_${webinarId}`, JSON.stringify({
            title: $scope.webinar.title,
            endedAt: new Date().toISOString(),
            endReason: 'video_duration_exceeded',
            message: 'This webinar has ended. Thank you for your interest!'
          }));
          
          // Redirect to ended page
          $state.go('webinar-ended', { webinarId: webinarId });
          return;
        }
      }
      
      // Set joining state
      $scope.isJoining = true;
      
      // Ensure we have registration data
      if (!$scope.registrationData || !$scope.registrationData.email) {
        console.error('No registration data found');
        ToastService.error('Registration required to join webinar room');
        $scope.isJoining = false;
        return;
      }
      
      // Save registration info to localStorage (ensure it's there)
      const registrationInfo = {
        webinarId: webinarId,
        name: $scope.registrationData.name,
        email: $scope.registrationData.email,
        company: $scope.registrationData.company || '',
        registeredAt: new Date().toISOString()
      };
      
      localStorage.setItem(`registration_${webinarId}`, JSON.stringify(registrationInfo));
  // console.debug('Registration info saved for room access:', registrationInfo);
      
      // Add a small delay and then navigate
  // console.debug('Navigating to webinar room...');
      ToastService.success('Joining webinar room...');
      
      setTimeout(function() {
        // Navigate to webinar room using ui-router
  // console.debug('Attempting navigation to webinarRoom state');
        $state.go('webinarRoom', { webinarId: webinarId })
          .then(function() {
            // console.debug('Navigation successful');
          })
          .catch(function(error) {
            console.error('Navigation failed:', error);
            ToastService.error('Failed to join webinar room');
            $scope.isJoining = false;
            if (!$scope.$$phase) {
              $scope.$apply();
            }
          });
      }, 100);
    };
    
    // Initialize
    $scope.loadWebinar();
  }
]);
