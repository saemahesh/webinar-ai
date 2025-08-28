// Webinar Room Controller (attendee + lightweight host tools)
angular.module('webinarApp')
.controller('WebinarRoomController', ['$scope', '$stateParams', '$state', '$http', '$timeout', '$interval', 'ToastService', 'AuthService', '$sce',
  function($scope, $stateParams, $state, $http, $timeout, $interval, ToastService, AuthService, $sce) {
    
    console.log('WebinarRoomController initialized');
    console.log('Webinar ID:', $stateParams.webinarId);
    
    // Initialize scope variables
    $scope.webinarId = $stateParams.webinarId;
    $scope.webinar = null;
    $scope.isLoading = true;
    $scope.isRegistered = false;
    $scope.attendee = null;
    $scope.chatMessages = [];
    $scope.isVideoLoaded = false;
    $scope.videoError = false;
    $scope.attendeeCount = 0;
    $scope.isWebinarLive = false; // Only true when scheduled start is reached
    $scope.isLeavingRoom = false; // Track if user is leaving
    $scope.showResumeButton = false; // Resume button state
    $scope.hasUserResumed = false; // Track if user has manually resumed
    $scope.isVideoLoading = false; // ITERATION 3: Show connecting animation during video loading
    $scope.videoMonitoringStarted = false; // ITERATION 0: Prevent duplicate video monitoring setup
    $scope.webinarJustWentLive = false; // ITERATION 1: Track when webinar just transitioned to live for auto-start
    $scope.liveMessageSent = false; // ITERATION 4: Prevent duplicate "We are live" chat messages
    
    // Video state management to prevent multiple downloads/plays
    $scope.videoState = {
      isInitialized: false,
      isLoading: false,
      hasStarted: false,
      calculatedStartTime: null,
      lastPlayAttempt: 0
    };
    
    // Audio/Video controls (disabled by default)
    $scope.micEnabled = false;
    $scope.videoEnabled = false;
    
    // Use object for ng-model to avoid scope inheritance issues
    $scope.chat = {
      newMessage: ''
    };
    
    // Chat visibility control
    $scope.chatHidden = false;
    
    // Auto-hide chat on mobile landscape
    (function setupMobileLandscapeAutoHide() {
      try {
        var mql = window.matchMedia('(max-width: 768px) and (orientation: landscape)');
        var lastLandscape = null; // tri-state: null (unknown), true (landscape), false (portrait)

        function applyAutoHide(initial) {
          var isLandscape = false;
          try { isLandscape = mql.matches; } catch(_) { /* no-op */ }

          // Only act when orientation state changes or on first run
          if (lastLandscape === isLandscape && !initial) return;
          lastLandscape = isLandscape;

          if (isLandscape) {
            // In mobile landscape, default to hiding the chat for video focus
            $scope.chatHidden = true;
          } else {
            // Back to portrait: default to showing chat
            $scope.chatHidden = false;
          }

          if (!$scope.$$phase) {
            $scope.$applyAsync();
          }
        }

        // Initial application
        applyAutoHide(true);

        // Listen for changes
        function onMqlChange() { applyAutoHide(false); }
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', onMqlChange);
        } else if (typeof mql.addListener === 'function') {
          // Safari fallback
          mql.addListener(onMqlChange);
        }

        // Orientation change fallback
        var onOrientation = function() { applyAutoHide(false); };
        window.addEventListener('orientationchange', onOrientation);

        // Cleanup listeners on scope destroy
        $scope.$on('$destroy', function() {
          try {
            if (typeof mql.removeEventListener === 'function') {
              mql.removeEventListener('change', onMqlChange);
            } else if (typeof mql.removeListener === 'function') {
              mql.removeListener(onMqlChange);
            }
          } catch(_) { /* ignore */ }
          try { window.removeEventListener('orientationchange', onOrientation); } catch(_) { /* ignore */ }
        });
      } catch(e) {
        console.warn('Auto-hide chat setup failed:', e);
      }
    })();
    
    $scope.toggleChat = function() {
      console.log('Toggle chat clicked - current state:', $scope.chatHidden);
      $scope.chatHidden = !$scope.chatHidden;
      console.log('Chat toggled - new state:', $scope.chatHidden ? 'HIDDEN' : 'VISIBLE');
      
      // Force scope update
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    };
    
    // Audio/Video control functions
    $scope.toggleMicrophone = function() {
      $scope.micEnabled = !$scope.micEnabled;
      console.log('Microphone toggled:', $scope.micEnabled ? 'ON' : 'OFF');
      // Here you would typically interface with getUserMedia API
      // For now, just visual feedback
    };
    
    $scope.toggleVideo = function() {
      $scope.videoEnabled = !$scope.videoEnabled;
      console.log('Video toggled:', $scope.videoEnabled ? 'ON' : 'OFF');
      // Here you would typically interface with getUserMedia API
      // For now, just visual feedback
    };
    
    console.log('WebinarRoomController - Chat enabled for testing:', $scope.isWebinarLive);
    
    // Initial system message (safe before start)
    $scope.chatMessages.push({
      sender: 'System',
      message: 'Welcome! The webinar will begin shortly.',
      timestamp: new Date(),
      isSystem: true
    });
    
    // Host control panel integration
    $scope.isHost = false;
    $scope.showHostControls = false;
    
    // Room state management
    $scope.roomState = {
      status: 'loading', // loading, waiting, live, ended
      currentTime: new Date(),
      webinarStartTime: null,
      timeToStart: 0
    };

    // Scheduled automated messages (host-configured)
    $scope.scheduledMessages = [];
    const deliveredKey = (id) => `delivered_${$scope.webinarId}_${id}`;
    
    // Clear delivery state when webinar data loads to ensure messages work on subsequent visits
    $scope.clearPreviousDeliveryState = function() {
      try {
        // Clear all delivered message flags for this webinar
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith(`delivered_${$scope.webinarId}_`)) {
            sessionStorage.removeItem(key);
          }
        });
        console.log('Cleared previous delivery state for webinar:', $scope.webinarId);
      } catch (e) {
        console.log('Could not clear delivery state:', e);
      }
    };
    
    function hasDelivered(id) {
      try { return sessionStorage.getItem(deliveredKey(id)) === '1'; } catch (_) { return false; }
    }
    function markDelivered(id) {
      try { sessionStorage.setItem(deliveredKey(id), '1'); } catch (_) {}
    }

    // Countdown interval ref
    let countdownInterval = null;

    function startCountdown() {
      stopCountdown();
      countdownInterval = $interval(function() {
        try {
          if (!$scope.webinar || !$scope.webinar.scheduledDate) return;
          const now = new Date();
          const startTime = new Date($scope.webinar.scheduledDate);
          $scope.roomState.timeToStart = Math.max(0, startTime.getTime() - now.getTime());

          // When countdown hits zero, flip to LIVE immediately (don't wait for the 5s monitor)
          if ($scope.roomState.timeToStart <= 0 && $scope.roomState.status === 'waiting') {
            console.log('🎬 Countdown reached zero - transitioning to live');
            $scope.roomState.status = 'live';
            $scope.isWebinarLive = true;
            $scope.webinarStatus = 'live';
            
            // ITERATION 5: Set flag to indicate countdown just finished 
            $scope.webinarJustWentLive = true;
            
            stopCountdown();
            // Give Angular a tick to render the <video>, then show "Let's Go" button
            $timeout(function() {
              if ($scope.webinar && $scope.webinar.videoPath) {
                // ITERATION 5: Start loading animation now that video element will be rendered
                $scope.isVideoLoading = true;
                console.log('ITERATION 5: Starting video loading animation after countdown');
                
                // Set up video monitoring
                $scope.setupVideoStateMonitoring();
                
                // Start video load check
                $timeout($scope.checkVideoLoad, 100);
                
                // ITERATION 5: Show "Let's Go" button when countdown completes (as user requested)
                console.log('🎬 ITERATION 5: Countdown complete - showing "Let\'s Go" button');
                $scope.showResumeButton = true;
                console.log('🎬 Current showResumeButton value:', $scope.showResumeButton);
                console.log('🎬 Current isVideoLoading value:', $scope.isVideoLoading);
              }
            }, 300);
            return;
          }

          // Safety: if state already changed elsewhere, stop this countdown
          if ($scope.roomState.status !== 'waiting') {
            stopCountdown();
          }
        } catch (e) { /* ignore */ }
      }, 1000);
    }

    function stopCountdown() {
      if (countdownInterval) {
        $interval.cancel(countdownInterval);
        countdownInterval = null;
      }
    }

    // Compute a trusted video URL for the template (used by ng-src)
  $scope.getVideoUrl = function() {
      try {
        var path = $scope.webinar && $scope.webinar.videoPath ? $scope.webinar.videoPath : null;
        if (!path) {
          return null;
        }
        
        // ITERATION 1: Use streaming endpoint for chunked video delivery
        // This enables range requests and prevents downloading entire video on seek
        var streamingUrl = '/api/videos/public/' + $scope.webinarId + '/stream';
        var url = window.location.origin + streamingUrl;
        
        console.log('ITERATION 1: Using streaming URL for chunked delivery:', url);
        return $sce.trustAsResourceUrl(url);
      } catch (e) {
        console.error('Error building video URL:', e);
        return null;
      }
    };

    // Expose a cached URL too (optional); will be set when webinar loads
    $scope.videoUrl = null;
    
    // Load webinar details
    $scope.loadWebinar = function() {
      $scope.isLoading = true;
      
      console.log('Starting webinar load process...');
      console.log('User authenticated:', AuthService.isLoggedIn());
      
      // Simplified approach - go directly to public API for attendees
  if (!AuthService.isLoggedIn()) {
        console.log('User not authenticated, using public API directly');
        $http.get(`/api/public/webinars/${$scope.webinarId}`)
          .then(function(response) {
            console.log('Public API response:', response.data);
            $scope.webinar = response.data.webinar || response.data;
            // Load any scheduled automated messages (public information for timing only)
            $scope.scheduledMessages = Array.isArray($scope.webinar.scheduledMessages) ? $scope.webinar.scheduledMessages : [];
            // Clear previous delivery state to ensure messages work on subsequent visits
            $scope.clearPreviousDeliveryState();            if ($scope.webinar) {
              $scope.roomState.webinarStartTime = new Date($scope.webinar.scheduledDate);
              
              // Check if webinar/video has ended before allowing entry (30 min video duration)
              const now = new Date();
              const startTime = new Date($scope.webinar.scheduledDate);
              const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
              
              // If webinar started and more than 30 minutes have passed (video duration)
              const webinarDurationMinutes = $scope.webinar.duration || 60;
              if (now >= startTime && elapsedMinutes >= webinarDurationMinutes) {
                console.log('Webinar/video has ended (' + webinarDurationMinutes + 'min), redirecting to ended page');
                $scope.redirectToEndedPage();
                return;
              }
              
              $scope.checkWebinarStatus();
              $scope.loadAttendeeInfo();
              $scope.checkHostPermissions();
              $scope.initializeRoom();

              // Set computed, trusted video URL for template binding
              $scope.videoUrl = $scope.getVideoUrl();
              $scope.startScheduledMessageWatcher();
            } else {
              ToastService.error('Webinar not found');
              $state.go('join', { webinarId: $scope.webinarId });
            }
          })
          .catch(function(error) {
            console.error('Public API error:', error);
            ToastService.error('Failed to load webinar details');
            $scope.isLoading = false;
          });
      } else {
        console.log('User authenticated, trying host API');
        // Authenticated user - try host API
    $http.get(`/api/webinars/${$scope.webinarId}`)
          .then(function(response) {
            console.log('Host API response:', response.data);
            $scope.webinar = response.data.webinar || response.data;
            $scope.scheduledMessages = Array.isArray($scope.webinar.scheduledMessages) ? $scope.webinar.scheduledMessages : [];
            // Clear previous delivery state to ensure messages work on subsequent visits
            $scope.clearPreviousDeliveryState();            if ($scope.webinar) {
              $scope.roomState.webinarStartTime = new Date($scope.webinar.scheduledDate);
              
              // Check if webinar/video has ended before allowing entry (30 min video duration)
              const now = new Date();
              const startTime = new Date($scope.webinar.scheduledDate);
              const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
              
              // If webinar started and more than 30 minutes have passed (video duration)
              const webinarDurationMinutes = $scope.webinar.duration || 60;
              if (now >= startTime && elapsedMinutes >= webinarDurationMinutes) {
                console.log('Webinar/video has ended (' + webinarDurationMinutes + 'min), redirecting to ended page');
                $scope.redirectToEndedPage();
                return;
              }
              
              $scope.checkWebinarStatus();
              $scope.loadAttendeeInfo();
              $scope.checkHostPermissions();
              $scope.initializeRoom();

              // Set computed, trusted video URL for template binding
              $scope.videoUrl = $scope.getVideoUrl();
              $scope.startScheduledMessageWatcher();
            } else {
              ToastService.error('Webinar not found');
              $state.go('join', { webinarId: $scope.webinarId });
            }
          })
          .catch(function(error) {
            console.error('Host API error, falling back to public:', error);
            // Fallback to public API
      $http.get(`/api/public/webinars/${$scope.webinarId}`)
              .then(function(response) {
                console.log('Public API fallback response:', response.data);
                $scope.webinar = response.data.webinar || response.data;
                $scope.scheduledMessages = Array.isArray($scope.webinar.scheduledMessages) ? $scope.webinar.scheduledMessages : [];
                // Clear previous delivery state to ensure messages work on subsequent visits
                $scope.clearPreviousDeliveryState();                if ($scope.webinar) {
                  $scope.roomState.webinarStartTime = new Date($scope.webinar.scheduledDate);
                  
                  // Check if webinar/video has ended before allowing entry (30 min video duration)
                  const now = new Date();
                  const startTime = new Date($scope.webinar.scheduledDate);
                  const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
                  
                  // ITERATION 5: Use webinar scheduled duration instead of hardcoded 30 minutes
                  const webinarDurationMinutes = $scope.webinar.duration || 60;
                  if (now >= startTime && elapsedMinutes >= webinarDurationMinutes) {
                    console.log('ITERATION 5: Webinar/video has ended (' + webinarDurationMinutes + 'min), redirecting to ended page');
                    $scope.redirectToEndedPage();
                    return;
                  }
                  
                  $scope.checkWebinarStatus();
                  $scope.loadAttendeeInfo();
                  $scope.checkHostPermissions();
                  $scope.initializeRoom();

                  // Set computed, trusted video URL for template binding
                  $scope.videoUrl = $scope.getVideoUrl();
                  $scope.startScheduledMessageWatcher();
                } else {
                  ToastService.error('Webinar not found');
                  $state.go('join', { webinarId: $scope.webinarId });
                }
              })
              .catch(function(publicError) {
                console.error('Both APIs failed:', publicError);
                ToastService.error('Failed to load webinar details');
                $scope.isLoading = false;
              });
          });
      }
    };
    
    // Check if current user is registered for this webinar
    $scope.loadAttendeeInfo = function() {
      const savedRegistration = localStorage.getItem(`registration_${$scope.webinarId}`);
      
      if (savedRegistration) {
        $scope.attendee = JSON.parse(savedRegistration);
        $scope.isRegistered = true;
        console.log('Attendee registration found:', $scope.attendee);
      } else {
        console.log('No registration found, redirecting to join page');
        $state.go('join', { webinarId: $scope.webinarId });
      }
    };
    
    // Check webinar status (waiting, live, ended) with IST timezone support
  $scope.checkWebinarStatus = function() {
      // Get current time in IST
      const now = new Date();
      console.log('Current UTC time:', now.toISOString());
      console.log('Current IST time:', now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      
      const startTime = new Date($scope.webinar.scheduledDate);
      console.log('Webinar UTC start time:', startTime.toISOString());
      console.log('Webinar IST start time:', startTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      
      const endTime = new Date(startTime.getTime() + ($scope.webinar.duration * 60 * 1000));
      console.log('Webinar IST end time:', endTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      
      $scope.roomState.currentTime = now;
      $scope.roomState.timeToStart = Math.max(0, startTime.getTime() - now.getTime());
      
      // Calculate timezone-aware status
      const timeDiff = now.getTime() - startTime.getTime();
      const endTimeDiff = now.getTime() - endTime.getTime();
      
      console.log('Time difference from start (minutes):', Math.round(timeDiff / (1000 * 60)));
      console.log('Time difference from end (minutes):', Math.round(endTimeDiff / (1000 * 60)));
      
  if (now < startTime) {
        $scope.roomState.status = 'waiting';
        $scope.isWebinarLive = false;
        $scope.webinarStatus = 'upcoming';
        console.log('Webinar is UPCOMING - starts in', Math.ceil($scope.roomState.timeToStart / (1000 * 60)), 'minutes');
        startCountdown();
  } else if (now >= startTime && now < endTime) {
        // Check if video has ended even though webinar duration hasn't ended
        const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
        
        // Try to get video duration to check if video has ended
        const video = document.getElementById('webinarVideo');
        let videoDurationMinutes = null;
        if (video && video.duration && !isNaN(video.duration)) {
          videoDurationMinutes = Math.floor(video.duration / 60);
          console.log('Video duration detected:', videoDurationMinutes, 'minutes');
        }
        
        // If we have video duration and elapsed time exceeds it, treat as ended
        if (videoDurationMinutes && elapsedMinutes >= videoDurationMinutes) {
          console.log('Video duration (' + videoDurationMinutes + ' min) exceeded, treating webinar as ended even though scheduled duration not reached');
          $scope.roomState.status = 'ended';
          $scope.isWebinarLive = false;
          $scope.webinarStatus = 'ended';
          $scope.redirectToEndedPage();
          return;
        }
        
        // ITERATION 4: If no video duration available, use webinar scheduled duration as fallback
        // This prevents premature ending when video duration is not yet detected
        if (!videoDurationMinutes && $scope.webinar && $scope.webinar.duration) {
          const scheduledDurationMinutes = $scope.webinar.duration;
          if (elapsedMinutes >= scheduledDurationMinutes) {
            console.log('ITERATION 4: Scheduled webinar duration (' + scheduledDurationMinutes + ' min) exceeded, treating webinar as ended');
            $scope.roomState.status = 'ended';
            $scope.isWebinarLive = false;
            $scope.webinarStatus = 'ended';
            $scope.redirectToEndedPage();
            return;
          }
        } else if (!videoDurationMinutes && elapsedMinutes >= 60) {
          // Ultimate fallback: 60 minutes if no video or webinar duration available
          console.log('ITERATION 4: Ultimate fallback - 60 min exceeded, treating webinar as ended');
          $scope.roomState.status = 'ended';
          $scope.isWebinarLive = false;
          $scope.webinarStatus = 'ended';
          $scope.redirectToEndedPage();
          return;
        }
        
    // ITERATION 1: Check if webinar is transitioning from waiting to live for auto-start
    const wasWaiting = ($scope.roomState.status === 'waiting');
    
    $scope.roomState.status = 'live';
    $scope.isWebinarLive = true;
    $scope.webinarStatus = 'live';
    
    // ITERATION 1: Set flag if this is the moment countdown just finished
    if (wasWaiting) {
      $scope.webinarJustWentLive = true;
      console.log('ITERATION 1: Webinar just transitioned from waiting to live - will auto-start video');
    }
    
        console.log('Webinar is LIVE - started', Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60)), 'minutes ago');
        
        // Auto-play video when webinar goes live (handled later in initialize/start monitoring)
        setTimeout(function() {
          if ($scope.webinar.videoPath && !$scope.videoError) {
            console.log('Webinar is live. Video will be started by initialize/monitor when element is present.');
            // No direct call here to avoid races before element exists
            
      // ITERATION 4: Only send "We are live" message once to prevent duplicates
      if (!$scope.liveMessageSent) {
        $scope.chatMessages.push({ sender: 'System', message: 'We are live. Thanks for joining!', timestamp: new Date(), isSystem: true });
        $scope.liveMessageSent = true;
        console.log('ITERATION 4: Sent "We are live" message to chat');
      } else {
        console.log('ITERATION 4: Skipped duplicate "We are live" message');
      }
          }
        }, 1000);
      } else {
        $scope.roomState.status = 'ended';
        $scope.isWebinarLive = false;
        $scope.webinarStatus = 'ended';
        console.log('Webinar has ENDED - ended', Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60)), 'minutes ago');
  stopCountdown();
        
        // If webinar has ended, block access and redirect
        $scope.redirectToEndedPage();
        return;
      }
      
  // Do NOT force-enable chat before start
      $scope.isLoading = false;
    };

    // Format time remaining as DD days HH:MM:SS (days omitted if 0)
    $scope.formatTimeToStart = function() {
      let ms = Math.max(0, $scope.roomState.timeToStart || 0);
      const days = Math.floor(ms / (24 * 60 * 60 * 1000));
      ms -= days * 24 * 60 * 60 * 1000;
      const hours = Math.floor(ms / (60 * 60 * 1000));
      ms -= hours * 60 * 60 * 1000;
      const minutes = Math.floor(ms / (60 * 1000));
      ms -= minutes * 60 * 1000;
      const seconds = Math.floor(ms / 1000);
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      const ss = seconds.toString().padStart(2, '0');
      return (days > 0 ? (days + 'd ') : '') + hh + ':' + mm + ':' + ss;
    };
    
    // Check host permissions
    $scope.checkHostPermissions = function() {
      if (AuthService.isLoggedIn() && $scope.webinar) {
        const currentUser = AuthService.getCurrentUser();
        $scope.isHost = (currentUser && currentUser.email === $scope.webinar.hostEmail);
        
        if ($scope.isHost) {
          console.log('Host detected, enabling host controls');
        }
      }
    };
    
    // Simple functions
    $scope.testChat = function() {
      console.log('testChat function called');
      $scope.chatMessages.push({
        sender: 'Host',
        message: 'This is a test message',
        timestamp: new Date(),
        isSystem: false
      });
      console.log('Test message added, total messages:', $scope.chatMessages.length);
    };
    
    $scope.sendMessage = function() {
      console.log('sendMessage called');
      console.log('chat.newMessage value:', $scope.chat.newMessage);
      console.log('chat.newMessage type:', typeof $scope.chat.newMessage);
      
      if ($scope.roomState.status !== 'live') {
        ToastService.warning('Chat will be available when the webinar starts');
        return;
      }

      if ($scope.chat.newMessage && $scope.chat.newMessage.trim()) {
        const message = {
          sender: $scope.attendee ? $scope.attendee.name : ($scope.currentUser ? $scope.currentUser.name : 'Anonymous'),
          message: $scope.chat.newMessage.trim(),
          timestamp: new Date(),
          isSystem: false,
          type: 'text'
        };
        
        $scope.chatMessages.push(message);
        console.log('Message added to chat:', message);
        console.log('Total messages now:', $scope.chatMessages.length);
        
        $scope.chat.newMessage = '';
        
        // Force apply scope changes
        if (!$scope.$$phase) {
          $scope.$apply();
        }
        
        // Scroll to bottom of chat
        $timeout(function() {
          const chatContainer = document.getElementById('chatContainer');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
            console.log('Scrolled chat to bottom');
          }
        }, 50);
      } else {
        console.log('Message not sent - empty or whitespace only');
        console.log('chat.newMessage is:', JSON.stringify($scope.chat.newMessage));
      }
    };
    
    $scope.leaveRoom = function() {
      console.log('Leave room function called - starting navigation');
      
      // Show loading to prevent multiple clicks
      $scope.isLeavingRoom = true;
      
      // Clear any stored webinar data
      console.log('Clearing webinar data from localStorage');
      localStorage.removeItem(`registration_${$scope.webinarId}`);
      
      // Show success message
      ToastService.success('Thank you for attending!');
      
      // Navigate to home page with a small delay to ensure UI updates
      setTimeout(function() {
        console.log('Navigating to home page');
        $state.go('home');
        
        // Force page reload after navigation to ensure clean state
        setTimeout(function() {
          window.location.href = '/';
        }, 100);
      }, 500);
    };
    
    // Handle ended webinar redirect
    $scope.redirectToEndedPage = function() {
      console.log('Redirecting to ended page - webinar has finished');
      // Store ended webinar info for display
      localStorage.setItem(`ended_webinar_${$scope.webinarId}`, JSON.stringify({
        title: $scope.webinar.title,
        endedAt: new Date().toISOString(),
        message: 'Thank you for attending!'
      }));
      
      // Redirect to a thank you/ended page
      $state.go('webinar-ended', { webinarId: $scope.webinarId });
    };
    
    // Video handling functions
    $scope.checkVideoLoad = function() {
      console.log('=== checkVideoLoad() called ===');
      const video = document.getElementById('webinarVideo');
      if (video) {
        console.log('Video element found in checkVideoLoad:');
        console.log('- src:', video.src);
        console.log('- readyState:', video.readyState, '(0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA)');
        console.log('- videoWidth:', video.videoWidth);
        console.log('- videoHeight:', video.videoHeight);
        console.log('- duration:', video.duration);
        console.log('- error:', video.error);
        
        // Check if video is loaded
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          console.log('✅ Video loaded successfully - readyState >= 2');
          $scope.isVideoLoaded = true;
          $scope.videoError = false;
          
          // ITERATION 3: Hide connecting animation when video is ready
          $scope.isVideoLoading = false;
          console.log('ITERATION 3: Set isVideoLoading = false (video ready)');
          
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // Set video to correct time position for live simulation
          $timeout(function() {
            const currentTime = $scope.calculateLiveVideoTime();
            if (currentTime !== null && currentTime > 0) {
              video.currentTime = currentTime;
              console.log('Video loaded - setting initial time to:', currentTime, 'seconds');
            }
            
            if (isMobile) {
              console.log('📱 Mobile device detected - using simplified video handling');
              // For mobile, just show resume button and skip complex synchronization
              $timeout(function() {
                console.log('📱 Mobile: Checking for resume state...');
                $scope.checkForResumeState();
              }, 1000);
            } else {
              // Start time synchronization for live webinars (desktop only)
              console.log('🖥️ Desktop: Starting time synchronization...');
              $scope.startTimeSynchronization();
              
              // Check if resume button should be shown (for refresh cases)
              $timeout(function() {
                console.log('🖥️ Desktop: Checking for resume state...');
                $scope.checkForResumeState();
              }, 1000);
            }
          }, isMobile ? 100 : 500); // Faster initialization for mobile
          
        } else if (video.error) {
          console.error('❌ Video loading error:', video.error);
          console.log('Error details:', {
            code: video.error.code,
            message: video.error.message
          });
          $scope.videoError = true;
          $scope.isVideoLoaded = false;
        } else {
          // Still loading, check again in 500ms
          console.log('⏳ Video still loading, readyState:', video.readyState, '- checking again in 500ms');
          $timeout($scope.checkVideoLoad, 500);
        }
      } else {
        console.error('❌ Video element not found in checkVideoLoad');
      }
    };
    
    // Start checking video load when webinar path is available
    $scope.$watch('webinar.videoPath', function(newVal) {
      if (newVal) {
        console.log('Video path available, starting load check');
        
        // ITERATION 7: Check if video loading should be blocked due to duration
        if ($scope.webinar && $scope.webinar.scheduledDate) {
          const webinarStartTime = new Date($scope.webinar.scheduledDate);
          const currentTime = new Date();
          const elapsedMinutes = (currentTime - webinarStartTime) / (1000 * 60);
          const effectiveDurationMinutes = $scope.webinar.duration || 60;
          
          if (elapsedMinutes >= effectiveDurationMinutes) {
            console.log('ITERATION 7: Video loading blocked - ' + effectiveDurationMinutes + ' minutes have passed since webinar start');
            $scope.redirectToEndedPage();
            return;
          }
        }
        
        // ITERATION 5: Only start loading animation if webinar is live (video element exists)
        if ($scope.roomState.status === 'live') {
          $scope.isVideoLoading = true;
          console.log('ITERATION 5: Set isVideoLoading = true (video URL assigned and webinar is live)');
          $timeout($scope.checkVideoLoad, 100);
        } else {
          console.log('ITERATION 5: Video path available but webinar not live yet, skipping loading animation');
        }
        
        // Update cached URL for template
        $scope.videoUrl = $scope.getVideoUrl();
      }
    });
    
    $scope.playVideo = function() {
      console.log('=== playVideo() called - MOBILE OPTIMIZED VERSION ===');
      
      // ITERATION 7: Check if video should be blocked due to video duration reached
      if ($scope.webinar && $scope.webinar.scheduledDate) {
        const webinarStartTime = new Date($scope.webinar.scheduledDate);
        const currentTime = new Date();
        const elapsedMinutes = (currentTime - webinarStartTime) / (1000 * 60);
        
        console.log('🚫 ITERATION 7 BLOCKING CHECK in playVideo():');
        console.log('- Webinar start time:', webinarStartTime);
        console.log('- Current time:', currentTime);
        console.log('- Elapsed minutes:', elapsedMinutes);
        
        // Check actual video duration first
        const video = document.getElementById('webinarVideo');
        let videoDurationMinutes = null;
        if (video && video.duration && !isNaN(video.duration)) {
          videoDurationMinutes = Math.floor(video.duration / 60);
          console.log('- Video duration detected:', videoDurationMinutes, 'minutes');
        }
        
        // Use video duration or webinar duration as fallback
        const effectiveDurationMinutes = videoDurationMinutes || $scope.webinar.duration || 60;
        console.log('- Effective duration:', effectiveDurationMinutes, 'minutes');
        
        if (elapsedMinutes >= effectiveDurationMinutes) {
          console.log('❌ BLOCKED: Video blocked - ' + effectiveDurationMinutes + ' minutes have passed since webinar start');
          ToastService.error('This webinar video is no longer available. The ' + effectiveDurationMinutes + '-minute viewing window has expired.');
          
          // Redirect to ended page
          $scope.redirectToEndedPage();
          return;
        }
      }
      
      // Prevent multiple simultaneous play attempts
      const now = Date.now();
      if (now - $scope.videoState.lastPlayAttempt < 2000) {
        console.log('⚠️ Play attempt too soon, ignoring to prevent multiple downloads');
        return;
      }
      $scope.videoState.lastPlayAttempt = now;
      
      const video = document.getElementById('webinarVideo');
      if (!video) {
        console.error('❌ Video element not found in playVideo()');
        return;
      }
      
      // Check if video is already playing
      if (!video.paused) {
        console.log('▶️ Video is already playing, no action needed');
        return;
      }
      
      console.log('Video element found:');
      console.log('- src:', video.src);
      console.log('- readyState:', video.readyState);
      console.log('- videoWidth:', video.videoWidth);
      console.log('- videoHeight:', video.videoHeight);
      console.log('- duration:', video.duration);
      console.log('- currentTime before:', video.currentTime);
      console.log('- paused:', video.paused);
      
      // Mobile-specific optimizations
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('📱 Mobile device detected, applying mobile-first optimizations');
        
        // Mobile-first approach: Set essential attributes
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'auto'; // Changed to auto for better mobile loading
        video.muted = true; // Start muted for autoplay compliance
        
        if (isAndroid) {
          console.log('🤖 Android device: Applying Android-specific optimizations');
          video.controls = false;
          // Force reload on Android to prevent stale video state
          if (video.readyState === 0) {
            console.log('🔄 Android: Forcing video reload due to readyState 0');
            video.load();
          }
        }
      }
      
      // Calculate and set video time - simplified for mobile
      if (!$scope.videoState.hasStarted) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // Mobile: Simple approach - just set to calculated time without complex logic
          const currentTime = $scope.calculateLiveVideoTime();
          if (currentTime > 0) {
            video.currentTime = currentTime;
            console.log('📱 Mobile: Set video time to', currentTime, 'seconds (simplified)');
          }
        } else {
          // Desktop: Use existing logic
          const currentTime = $scope.calculateLiveVideoTime();
          if (currentTime !== null && currentTime > 0) {
            console.log('🖥️ Desktop: Setting video start time to:', currentTime, 'seconds');
            video.currentTime = currentTime;
            $scope.videoState.calculatedStartTime = currentTime;
          }
        }
        $scope.videoState.hasStarted = true;
      }
      
      // Start video playback with mobile-optimized approach
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.then(function() {
          console.log('✅ Video play() succeeded');
          
          // Mobile-specific post-play handling
          if (isMobile) {
            console.log('📱 Mobile: Video started successfully');
            // Gradual unmute for mobile after successful play
            setTimeout(function() {
              video.muted = false;
              console.log('🔊 Mobile: Video unmuted after successful play');
            }, 200);
          } else {
            console.log('🖥️ Desktop: Video started successfully');
          }
          
          console.log('- paused after play:', video.paused);
          console.log('- muted:', video.muted);
          console.log('- volume:', video.volume);
          
          // Hide resume button since video is playing
          $scope.showResumeButton = false;
          if (!$scope.$$phase) {
            $scope.$apply();
          }
          
        }).catch(function(error) {
          console.error('❌ Error playing video:', error);
          console.log('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
          });
          
          if (isMobile) {
            console.log('📱 Mobile play failed, trying recovery approach...');
            // Mobile recovery: Try with different settings
            setTimeout(function() {
              video.muted = true;
              video.load();
              setTimeout(function() {
                video.play().catch(function(retryError) {
                  console.error('❌ Mobile video recovery also failed:', retryError);
                });
              }, 500);
            }, 1000);
          }
          
          // Show resume button on play failure
          $scope.showResumeButton = true;
          if (!$scope.$$phase) {
            $scope.$apply();
          }
        });
      } else {
        // Fallback for older browsers
        console.log('⚠️ Video.play() does not return a promise, using fallback');
      }
    };
    
    // Calculate what time the video should be at based on webinar start time
    $scope.calculateLiveVideoTime = function() {
      if (!$scope.webinar || !$scope.webinar.scheduledDate) {
        return null;
      }
      
      // For mobile devices, use cached calculation to avoid repeated calculations
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile && $scope.videoState.calculatedStartTime !== null) {
        console.log('📱 Using cached start time for mobile:', $scope.videoState.calculatedStartTime);
        return $scope.videoState.calculatedStartTime;
      }
      
      const now = new Date();
      const webinarStartTime = new Date($scope.webinar.scheduledDate);
      
      // If webinar hasn't started yet, return 0
      if (now < webinarStartTime) {
        return 0;
      }
      
      // Calculate how many seconds have passed since webinar started
      const elapsedSeconds = Math.floor((now.getTime() - webinarStartTime.getTime()) / 1000);
      
      console.log('Webinar started at:', webinarStartTime);
      console.log('Current time:', now);
      console.log('Elapsed seconds since start:', elapsedSeconds);
      
      // Cache the result for mobile devices to avoid recalculation
      if (isMobile) {
        $scope.videoState.calculatedStartTime = elapsedSeconds;
        console.log('📱 Cached start time for mobile:', elapsedSeconds);
      }
      
      return elapsedSeconds;
    };
    
    // Start time synchronization for live simulation (disabled on mobile for stability)
    $scope.startTimeSynchronization = function() {
      // Detect mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('📱 Mobile detected: Skipping time synchronization completely for stable playback');
        // For mobile, only set initial time and rely on natural video playback
        const video = document.getElementById('webinarVideo');
        if (video && $scope.roomState.status === 'live') {
          const initialTime = $scope.calculateLiveVideoTime();
          if (initialTime > 0) {
            video.currentTime = initialTime;
            console.log('📱 Mobile: Set initial video time to', initialTime, 'seconds');
          }
        }
        return;
      }
      
      // Desktop: User-suggested minimal monitoring approach (no frequent interruptions)
      if ($scope.roomState.status === 'live' && $scope.webinar.videoPath) {
        console.log('�️ Desktop: Starting time synchronization');
        const syncInterval = setInterval(function() {
          const video = document.getElementById('webinarVideo');
          if (video && !video.paused && video.readyState >= 2) {
            const expectedTime = $scope.calculateLiveVideoTime();
            const currentVideoTime = video.currentTime;
            const timeDifference = Math.abs(expectedTime - currentVideoTime);
            
            // Only show resume button for major drift (>5 seconds), don't auto-resync
            if (timeDifference > 5) {
              console.log('�️ Desktop: Major time drift detected:', timeDifference, 'seconds. Showing resume button.');
              $scope.showResumeButton = true;
              $scope.$apply();
              // Stop monitoring once drift detected - user controls resync timing
              clearInterval(syncInterval);
              console.log('Monitoring stopped - user controls resync via resume button (per user feedback)');
            }
          }
          
          // Stop syncing if webinar is no longer live
          if ($scope.roomState.status !== 'live') {
            console.log('🛑 Stopping time synchronization - webinar no longer live');
            clearInterval(syncInterval);
          }
        }, 120000); // Check only every 2 minutes - minimal interference per user suggestion
        
        // Clear interval when leaving the page
        window.addEventListener('beforeunload', function() {
          clearInterval(syncInterval);
        });
      }
    };
    
    $scope.pauseVideo = function() {
      const video = document.getElementById('webinarVideo');
      if (video) {
        video.pause();
      }
    };
    
    $scope.toggleVideo = function() {
      const video = document.getElementById('webinarVideo');
      if (video) {
        if (video.paused) {
          $scope.playVideo();
        } else {
          $scope.pauseVideo();
        }
      }
    };
    
    // Resume video functionality (for after refresh)
    $scope.resumeVideo = function() {
      console.log('🎬 Resume video clicked - MOBILE OPTIMIZED');
      
      // ITERATION 7: Check if video should be blocked due to video duration reached
      if ($scope.webinar && $scope.webinar.scheduledDate) {
        const webinarStartTime = new Date($scope.webinar.scheduledDate);
        const currentTime = new Date();
        const elapsedMinutes = (currentTime - webinarStartTime) / (1000 * 60);
        
        console.log('🚫 ITERATION 7 BLOCKING CHECK in resumeVideo():');
        console.log('- Webinar start time:', webinarStartTime);
        console.log('- Current time:', currentTime);
        console.log('- Elapsed minutes:', elapsedMinutes);
        
        // Check actual video duration first
        const video = document.getElementById('webinarVideo');
        let videoDurationMinutes = null;
        if (video && video.duration && !isNaN(video.duration)) {
          videoDurationMinutes = Math.floor(video.duration / 60);
          console.log('- Video duration detected:', videoDurationMinutes, 'minutes');
        }
        
        // Use video duration or webinar duration as fallback
        const effectiveDurationMinutes = videoDurationMinutes || $scope.webinar.duration || 60;
        console.log('- Effective duration:', effectiveDurationMinutes, 'minutes');
        
        if (elapsedMinutes >= effectiveDurationMinutes) {
          console.log('❌ BLOCKED: Video blocked - ' + effectiveDurationMinutes + ' minutes have passed since webinar start');
          ToastService.error('This webinar video is no longer available. The ' + effectiveDurationMinutes + '-minute viewing window has expired.');
          
          // Redirect to ended page
          $scope.redirectToEndedPage();
          return;
        }
      }
      
      // Prevent multiple resume attempts
      const now = Date.now();
      if (now - $scope.videoState.lastPlayAttempt < 2000) {
        console.log('⚠️ Resume attempt too soon, ignoring to prevent multiple downloads');
        return;
      }
      $scope.videoState.lastPlayAttempt = now;
      
      $scope.showResumeButton = false;
      $scope.hasUserResumed = true;
      
      const video = document.getElementById('webinarVideo');
      if (!video || !$scope.webinar.videoPath) {
        console.error('❌ Video element or path not found');
        return;
      }
      
      // Mobile device detection
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('📱 Mobile resume - applying mobile optimizations');
        video.playsInline = true;
        video.preload = 'metadata';
        
        if (isAndroid) {
          console.log('🤖 Android resume - applying Android-specific fixes');
          video.controls = false;
        }
      }
      
      // Use cached start time if available, otherwise calculate
      let currentTime;
      if ($scope.videoState.calculatedStartTime !== null) {
        currentTime = $scope.videoState.calculatedStartTime;
        console.log('📺 Using cached start time:', currentTime, 'seconds');
      } else {
        currentTime = $scope.calculateLiveVideoTime();
        if (currentTime !== null && currentTime > 0) {
          $scope.videoState.calculatedStartTime = currentTime;
          console.log('⏰ Calculated new start time:', currentTime, 'seconds');
        }
      }
      
      if (currentTime !== null && currentTime > 0) {
        video.currentTime = currentTime;
        console.log('🕐 Resuming video at time:', currentTime, 'seconds');
      }
      
      // Start muted on mobile to ensure playback
      if (isMobile) {
        video.muted = true;
        console.log('🔇 Starting muted for mobile resume');
      } else {
        video.muted = false;
      }
      
      video.play().then(() => {
        console.log('✅ Video resumed successfully');
        
        // Unmute after successful play on mobile
        if (isMobile) {
          setTimeout(function() {
            video.muted = false;
            console.log('🔊 Video unmuted after successful mobile resume');
          }, 100);
        }
        
        // Hide all other controls after resume
        $scope.hideOtherControlsAfterResume();
        $scope.videoState.hasStarted = true;
        
      }).catch(error => {
        console.error('❌ Error resuming video:', error);
        // Show resume button again on error
        $scope.showResumeButton = true;
        if (!$scope.$$phase) {
          $scope.$apply();
        }
      });
    };
    
    // Hide other video controls after manual resume
    $scope.hideOtherControlsAfterResume = function() {
      // You can add logic here to hide other video controls if needed
      console.log('Video resumed - other controls can be managed here');
    };
    
    // Check if video should show resume button (on refresh during live webinar)
    $scope.checkForResumeState = function() {
      if ($scope.roomState.status === 'live' && $scope.webinar.videoPath && !$scope.hasUserResumed) {
        console.log('Live webinar detected - showing resume button for user interaction');
        $scope.showResumeButton = true;
        console.log('Resume button set to true on page load for live webinar');
      }
    };
    
    // Monitor video state and automatically hide resume button when video plays
    $scope.setupVideoStateMonitoring = function() {
      const video = document.getElementById('webinarVideo');
      if (video) {
        // Remove existing listeners to avoid duplicates
        video.removeEventListener('play', $scope.onVideoPlay);
        video.removeEventListener('pause', $scope.onVideoPause);
        
        // Add new listeners
        video.addEventListener('play', $scope.onVideoPlay);
        video.addEventListener('pause', $scope.onVideoPause);
        console.log('📺 Video state monitoring set up');
        
        // ITERATION 7: Removed auto-start logic - user wants "Let's Go" button to appear and wait for click
        console.log('ITERATION 7: Video monitoring set up, waiting for user to click "Let\'s Go" button');
      } else {
        console.log('ITERATION 7: Video element not found, retrying in 200ms...');
        // ITERATION 2: If video element not found, keep trying
        $timeout(function() {
          $scope.setupVideoStateMonitoring();
        }, 200);
      }
    };
    
    $scope.onVideoPlay = function() {
      console.log('📺 Video started playing - hiding resume button');
      $scope.showResumeButton = false;
      $scope.$apply();
    };
    
    $scope.onVideoPause = function() {
      console.log('📺 Video paused');
      // Don't automatically show resume button on pause, let other logic handle it
    };
    
    // Simulate attendee count changes according to time-based rules
    // - Ramp from ~23 to 232 over first 5 minutes after start
    // - Mid-session: change by ±3..±10 each minute around ~232
    // - Last 10 minutes: ramp down smoothly toward 150–180
    $scope.startAttendeeSimulation = function() {
      const storageKey = `attendeeCount_${$scope.webinarId}`;
      const metaKey = `attendeeCountMeta_${$scope.webinarId}`;
      const lastUpdateKey = `lastAttendeeUpdate_${$scope.webinarId}`;

      const startTime = new Date($scope.webinar.scheduledDate).getTime();
      const durationMs = ($scope.webinar.duration || 60) * 60 * 1000; // default 60 mins
      const endTime = startTime + durationMs;

      let storedCount = parseInt(localStorage.getItem(storageKey), 10);
      if (isNaN(storedCount)) storedCount = null;
      let meta = null;
      try { meta = JSON.parse(localStorage.getItem(metaKey) || 'null'); } catch (e) { meta = null; }
      if (!meta || typeof meta.targetEnd !== 'number') {
        meta = { targetEnd: Math.floor(150 + Math.random() * 31) }; // 150-180
      }

      const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

      function computeExpectedCount(nowMs) {
        if (nowMs < startTime) {
          // Before the webinar starts, participant count should be 0
          return 0;
        }
        if (nowMs >= endTime) {
          return meta.targetEnd;
        }
        const elapsed = nowMs - startTime;
        const remaining = endTime - nowMs;
        const rampUpMs = 5 * 60 * 1000;
        if (elapsed <= rampUpMs) {
          const frac = clamp(elapsed / rampUpMs, 0, 1);
          return 23 + Math.round((232 - 23) * frac);
        }
        const rampDownMs = 10 * 60 * 1000;
        if (remaining <= rampDownMs) {
          const frac = clamp(1 - (remaining / rampDownMs), 0, 1);
          return 232 + Math.round((meta.targetEnd - 232) * frac);
        }
        return 232; // mid-session
      }

      // Initialize count
      const nowInit = Date.now();
      const expectedNow = computeExpectedCount(nowInit);
      if (storedCount === null) {
        // Initialize with expected value; before start this will be 0
        $scope.attendeeCount = clamp(expectedNow, 0, 500);
      } else {
        const delta = expectedNow - storedCount;
        const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 7), -7, 7);
        $scope.attendeeCount = clamp(storedCount + step, 0, 500);
      }

      localStorage.setItem(storageKey, String($scope.attendeeCount));
      localStorage.setItem(metaKey, JSON.stringify(meta));
      localStorage.setItem(lastUpdateKey, String(nowInit));
      console.log('Attendee count (init):', $scope.attendeeCount);

      // Use $interval for continuous real-time updates every 5 seconds
      const attendeeInterval = $interval(function() {
        const now = Date.now();
        const lastUpdate = parseInt(localStorage.getItem(lastUpdateKey), 10) || now;
        const timeSinceLastUpdate = now - lastUpdate;
        
        // Only update if enough time has passed based on current phase
        let requiredInterval = 60000; // default 1 minute
        if (now < startTime) {
          requiredInterval = 30000; // 30 seconds before start
        } else if (now >= startTime && now <= startTime + 5 * 60 * 1000) {
          requiredInterval = 10000; // 10 seconds during ramp-up
        } else if (now >= endTime - 10 * 60 * 1000 && now < endTime) {
          requiredInterval = 10000; // 10 seconds during ramp-down
        }

    if (timeSinceLastUpdate >= requiredInterval) {
          const expected = computeExpectedCount(now);
          
          if (now < startTime) {
            const delta = expected - $scope.attendeeCount;
            const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 2), -2, 2);
      $scope.attendeeCount = clamp($scope.attendeeCount + step, 0, 500);
          } else if (now >= startTime && now <= startTime + 5 * 60 * 1000) {
            const delta = expected - $scope.attendeeCount;
            const stepMag = clamp(Math.min(Math.abs(delta), Math.floor(3 + Math.random() * 7)), 1, 12);
            const step = Math.sign(delta) * stepMag;
      $scope.attendeeCount = clamp($scope.attendeeCount + step, 0, 500);
          } else if (now >= endTime - 10 * 60 * 1000 && now < endTime) {
            const delta = expected - $scope.attendeeCount;
            const stepMag = clamp(Math.min(Math.abs(delta), Math.floor(2 + Math.random() * 6)), 1, 10);
            const step = Math.sign(delta) * stepMag;
      $scope.attendeeCount = clamp($scope.attendeeCount + step, 0, 500);
          } else if (now >= endTime) {
            const delta = expected - $scope.attendeeCount;
            const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 2), -2, 2);
      $scope.attendeeCount = clamp($scope.attendeeCount + step, 0, 500);
          } else {
            // Mid-session: ±3 to ±10 changes with gentle pull toward 232
            const pull = clamp(232 - $scope.attendeeCount, -5, 5);
            const magnitude = Math.floor(3 + Math.random() * 8); // 3-10
            const sign = Math.random() < 0.5 ? -1 : 1;
            const randomStep = sign * magnitude;
      $scope.attendeeCount = clamp($scope.attendeeCount + pull + randomStep, 0, 500);
          }

          localStorage.setItem(storageKey, String($scope.attendeeCount));
          localStorage.setItem(metaKey, JSON.stringify(meta));
          localStorage.setItem(lastUpdateKey, String(now));
          console.log('Attendee count updated to:', $scope.attendeeCount, 'at', new Date(now).toLocaleTimeString());
        }
      }, 5000); // Check every 5 seconds for real-time behavior

      $scope.$on('$destroy', function() {
        if (attendeeInterval) {
          $interval.cancel(attendeeInterval);
        }
        stopCountdown();
      });
    };

    // Initialize room (basic simulation)
    $scope.initializeRoom = function() {
      // Start attendee simulation with time-based behavior
      $scope.startAttendeeSimulation();
      
      // Ensure no non-system messages before live
      $scope.chatMessages = $scope.chatMessages.filter(m => m.isSystem);
      
      // Debug video path
      console.log('Webinar video path:', $scope.webinar.videoPath);
      console.log('Webinar hasVideo:', $scope.webinar.hasVideo);
      if ($scope.webinar.videoPath) {
        console.log('Video should be available at:', $scope.webinar.videoPath);
      } else {
        console.log('No video path found in webinar data');
        console.log('Full webinar object:', $scope.webinar);
      }
      
      // If webinar is currently live, set up video monitoring and show resume button for user interaction
      if ($scope.roomState.status === 'live' && $scope.webinar.videoPath) {
        setTimeout(function() {
          console.log('Setting up video monitoring for live webinar');
          $scope.setupVideoStateMonitoring();
          
          // Always show resume button for live webinars to ensure user can interact and unmute
          if (!$scope.hasUserResumed) {
            console.log('Live webinar detected - showing resume button for user interaction');
            $scope.showResumeButton = true;
            $scope.$apply();
          } else {
            console.log('User has already resumed - no action needed');
          }
        }, 2000);
      }
    };

    // Scheduled automated messages delivery watcher
    $scope.startScheduledMessageWatcher = function() {
      // Clear any previous delivery state if webinar changes
      let lastCheck = 0;
      const poll = $interval(function() {
        try {
          // Must have webinar and scheduled date/time
          if (!$scope.webinar || !$scope.webinar.scheduledDate) return;
          if (!Array.isArray($scope.scheduledMessages) || !$scope.scheduledMessages.length) return;

          const now = Date.now();
          if (now - lastCheck < 1000) return; // throttle to prevent spam
          lastCheck = now;

          // Parse the scheduled start time
          const scheduledStartTime = new Date($scope.webinar.scheduledDate);
          const startMs = scheduledStartTime.getTime();
          
          // CRITICAL: Only deliver messages AFTER the scheduled date and time
          if (now < startMs) {
            console.log('Webinar not started yet. Scheduled for:', scheduledStartTime.toLocaleString());
            return; 
          }

          // Only push during LIVE window (within duration)
          const durationMinutes = Number($scope.webinar.duration) || 30;
          const endMs = startMs + (durationMinutes * 60 * 1000);
          if (now > endMs) {
            console.log('Webinar ended. No more automated messages.');
            return;
          }

          // Process each scheduled message
          $scope.scheduledMessages.forEach(function(sm) {
            if (!sm || !sm.id) return;
            
            const atSec = Number(sm.atSeconds || 0);
            const fireAt = startMs + Math.max(0, atSec) * 1000;
            
            // Fire message only if:
            // 1. Current time >= message fire time
            // 2. Message hasn't been delivered yet
            if (now >= fireAt && !hasDelivered(sm.id)) {
              console.log('Delivering automated message:', sm.text, 'at', new Date(fireAt).toLocaleString());
              $scope.pushAutomatedChat(sm);
              markDelivered(sm.id);
            }
          });
        } catch (e) {
          console.error('Error in scheduled message watcher:', e);
        }
      }, 1000);

      $scope.$on('$destroy', function() { if (poll) $interval.cancel(poll); });
    };

    // Render a scheduled message in chat
    $scope.pushAutomatedChat = function(sm) {
      const base = {
        id: sm.id,
        sender: sm.sender || 'Host',
        timestamp: new Date(),
        isSystem: false,
        type: sm.kind || sm.type || 'text'
      };
      if (base.type === 'cta') {
        $scope.chatMessages.push({
          ...base,
          message: sm.text || 'Check this out',
          buttons: Array.isArray(sm.buttons) ? sm.buttons : (sm.buttonLabel && sm.buttonUrl ? [{ label: sm.buttonLabel, url: sm.buttonUrl }] : [])
        });
      } else if (base.type === 'image') {
        $scope.chatMessages.push({
          ...base,
          message: sm.caption || sm.text || '',
          imageUrl: sm.imageUrl
        });
      } else {
        $scope.chatMessages.push({ ...base, message: sm.text || '' });
      }

      // Scroll to bottom
      $timeout(function() {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    };

    // ---------- Host: Automated message scheduler (simple popup) ----------
    $scope.scheduler = {
      open: false,
      editing: [], // local editable copy
      saving: false
    };

    $scope.openScheduler = function() {
      if (!$scope.isHost) { return; }
      $scope.scheduler.open = true;
      // clone existing messages
      $scope.scheduler.editing = ($scope.scheduledMessages || []).map(m => ({ ...m }));
    };

    $scope.closeScheduler = function() {
      $scope.scheduler.open = false;
    };

    function genId() { return 'sm_' + Math.random().toString(36).slice(2) + Date.now(); }

    $scope.addScheduledTextAtNow = function() {
      const t = $scope.getCurrentVideoSeconds();
      $scope.scheduler.editing.push({ id: genId(), kind: 'text', text: 'New message', atSeconds: t });
    };
    $scope.addScheduledCTAAtNow = function() {
      const t = $scope.getCurrentVideoSeconds();
      $scope.scheduler.editing.push({ id: genId(), kind: 'cta', text: 'Limited offer', buttonLabel: 'Buy now', buttonUrl: 'https://example.com', atSeconds: t, buttons: [] });
    };
    $scope.addScheduledImageAtNow = function() {
      const t = $scope.getCurrentVideoSeconds();
      $scope.scheduler.editing.push({ id: genId(), kind: 'image', imageUrl: '', caption: '', atSeconds: t });
    };

    $scope.removeScheduled = function(id) {
      $scope.scheduler.editing = $scope.scheduler.editing.filter(m => m.id !== id);
    };

    $scope.getCurrentVideoSeconds = function() {
      try {
        const video = document.getElementById('webinarVideo');
        if (video && !isNaN(video.currentTime)) return Math.floor(video.currentTime);
      } catch(e) {}
      // fallback: compute based on clock since start
      if ($scope.webinar && $scope.webinar.scheduledDate) {
        const now = Date.now();
        const start = new Date($scope.webinar.scheduledDate).getTime();
        return Math.max(0, Math.floor((now - start)/1000));
      }
      return 0;
    };

    $scope.saveScheduledMessages = function() {
      if (!$scope.isHost) return;
      $scope.scheduler.saving = true;
      // Normalize buttons array for cta kind
      const payload = $scope.scheduler.editing.map(m => ({
        id: m.id || genId(),
        kind: m.kind || m.type || 'text',
        text: m.text || '',
        atSeconds: Math.max(0, parseInt(m.atSeconds || 0, 10)),
        imageUrl: m.imageUrl || undefined,
        caption: m.caption || undefined,
        buttons: Array.isArray(m.buttons) ? m.buttons.filter(b => b && b.label && b.url) : (m.buttonLabel && m.buttonUrl ? [{ label: m.buttonLabel, url: m.buttonUrl }] : [])
      }));

      $http.put(`/api/webinars/${$scope.webinarId}/scheduled-messages`, { scheduledMessages: payload })
        .then(res => {
          ToastService.success('Automated messages saved');
          $scope.scheduledMessages = payload;
          $scope.scheduler.saving = false;
          $scope.scheduler.open = false;
        })
        .catch(err => {
          console.error('Failed to save scheduled messages', err);
          ToastService.error('Failed to save messages');
          $scope.scheduler.saving = false;
        });
    };
    
    // Initialize controller
    $scope.loadWebinar();
    
    // Start periodic status checking for waiting webinars and continuous monitoring during live
    $scope.startStatusMonitoring = function() {
      // ITERATION 0: Continue monitoring even after webinar goes live to check video duration
      // Use $interval for Angular digest and check every 1s for status changes
      const statusCheckInterval = $interval(function() {
        $scope.checkWebinarStatus();

        // If webinar becomes live for first time, set up video monitoring
        if ($scope.roomState.status === 'live' && !$scope.videoMonitoringStarted) {
          console.log('Webinar has gone live! Checking video state before showing button...');
          $scope.videoMonitoringStarted = true; // Prevent duplicate setup
          
          $timeout(function() {
            if ($scope.webinar && $scope.webinar.videoPath && !$scope.videoError) {
              // Set up video monitoring
              $scope.setupVideoStateMonitoring();
              
              // ITERATION 6: Check if countdown just finished and show button
              if ($scope.webinarJustWentLive) {
                console.log('ITERATION 6: Countdown just finished, ensuring "Let\'s Go" button shows');
                $scope.webinarJustWentLive = false; // Reset flag
                $scope.showResumeButton = true; // Show button when countdown finishes
              } else {
                // Check if video is already playing before showing button
                const video = document.getElementById('webinarVideo');
                if (video && !video.paused) {
                  console.log('📺 Status monitoring: Video is already playing, not showing resume button');
                  $scope.showResumeButton = false;
                } else {
                  // Show resume button only if video is not playing and countdown didn't just finish
                  console.log('📺 Status monitoring: Setting showResumeButton to true');
                  $scope.showResumeButton = true;
                  console.log('📺 Status monitoring: Current showResumeButton value:', $scope.showResumeButton);
                }
              }
            }
          }, 300);
        }
        
        // ITERATION 7: Removed continuous auto-start check - user wants manual "Let's Go" button interaction
        
        // ITERATION 0: Don't cancel interval - keep checking for duration exceeded and ended status
        if ($scope.roomState.status === 'ended') {
          console.log('ITERATION 0: Webinar ended, stopping status monitoring');
          $interval.cancel(statusCheckInterval);
        }
      }, 1000);

      // Clear interval when leaving/destroying scope
      $scope.$on('$destroy', function() {
        if (statusCheckInterval) {
          $interval.cancel(statusCheckInterval);
        }
      });
    };
    
    // Start monitoring after webinar loads
    setTimeout(function() {
      $scope.startStatusMonitoring();
    }, 1000);
    
    // Video event handlers for HTML video element
    $scope.onVideoLoad = function() {
      console.log('=== onVideoLoad() called from HTML event ===');
      const video = document.getElementById('webinarVideo');
      if (video) {
        console.log('Video load event - readyState:', video.readyState);
        console.log('Video dimensions:', video.videoWidth + 'x' + video.videoHeight);
        console.log('Video duration:', video.duration);
        
        // DEBUG: Check computed styles and actual dimensions
        const computedStyle = window.getComputedStyle(video);
        console.log('=== VIDEO ELEMENT DEBUGGING ===');
        console.log('Element dimensions:');
        console.log('- offsetWidth:', video.offsetWidth);
        console.log('- offsetHeight:', video.offsetHeight);
        console.log('- clientWidth:', video.clientWidth);
        console.log('- clientHeight:', video.clientHeight);
        console.log('- getBoundingClientRect:', video.getBoundingClientRect());
        
        console.log('Computed styles:');
        console.log('- width:', computedStyle.width);
        console.log('- height:', computedStyle.height);
        console.log('- minWidth:', computedStyle.minWidth);
        console.log('- minHeight:', computedStyle.minHeight);
        console.log('- maxWidth:', computedStyle.maxWidth);
        console.log('- maxHeight:', computedStyle.maxHeight);
        console.log('- display:', computedStyle.display);
        console.log('- position:', computedStyle.position);
        console.log('- flex:', computedStyle.flex);
        
        // Check parent containers
        const videoContainer = video.closest('.video-container') || video.parentElement;
        if (videoContainer) {
          console.log('Parent container dimensions:');
          console.log('- offsetWidth:', videoContainer.offsetWidth);
          console.log('- offsetHeight:', videoContainer.offsetHeight);
          console.log('- className:', videoContainer.className);
        }
        
        $scope.isVideoLoaded = true;
        $scope.videoError = false;
        
        // Force scope update
        if (!$scope.$$phase) {
          $scope.$apply();
        }
      }
    };
    
    $scope.onVideoError = function() {
      console.log('=== onVideoError() called from HTML event ===');
      const video = document.getElementById('webinarVideo');
      if (video && video.error) {
        console.error('Video error details:', {
          code: video.error.code,
          message: video.error.message
        });
      }
      
      $scope.videoError = true;
      $scope.isVideoLoaded = false;
      
      // ITERATION 3: Hide connecting animation on video error
      $scope.isVideoLoading = false;
      console.log('ITERATION 3: Set isVideoLoading = false (video error)');
      
      // Force scope update
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    };

    $scope.onVideoEnded = function() {
      console.log('=== onVideoEnded() called - Video has finished playing ===');
      const video = document.getElementById('webinarVideo');
      if (video) {
        console.log('Video ended - duration:', video.duration, 'currentTime:', video.currentTime);
        
        // Check if we're in a live webinar and video has actually ended
        if ($scope.roomState.status === 'live' && video.currentTime >= video.duration) {
          console.log('Video has ended during live webinar - redirecting to ended page');
          
          // Store ended webinar info for display
          localStorage.setItem(`ended_webinar_${$scope.webinarId}`, JSON.stringify({
            title: $scope.webinar.title,
            endedAt: new Date().toISOString(),
            endReason: 'video_completed',
            message: 'Thank you for attending! The video presentation has completed.'
          }));
          
          // Show toast message
          ToastService.info('Webinar has ended. Thank you for attending!');
          
          // Redirect to ended page after a short delay
          $timeout(function() {
            $scope.redirectToEndedPage();
          }, 2000);
        }
      }
    };
    
    console.log('WebinarRoomController setup complete');
  }
]);
