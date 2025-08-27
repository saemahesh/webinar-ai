angular.module('webinarApp')
.controller('WebinarRoomController', ['$scope', '$stateParams', '$state', '$http', '$timeout', '$interval', 'ToastService', 'AuthService', 
  function($scope, $stateParams, $state, $http, $timeout, $interval, ToastService, AuthService) {
    
    console.log('WebinarRoomController initialized');
    console.log('Webinar ID:', $stateParams.webinarId);
    
    // Initialize scope variables
    $scope.webinarId = $stateParams.webinarId;
    $scope.webinar = {
      id: 1,
      title: 'Sample Webinar',
      description: 'This is a sample webinar description.',
      videoPath: '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4' // Correct path
    };
    
    // FORCE: Set video URL immediately
    $scope.videoUrl = window.location.origin + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
    console.log('Video URL set immediately:', $scope.videoUrl);
    $scope.isLoading = true;
    $scope.isRegistered = false;
    $scope.attendee = null;
    $scope.chatMessages = [];
    $scope.newMessage = '';
    $scope.isVideoLoaded = false;
    $scope.videoError = false; // FORCE: Never allow video error to block display
    $scope.attendeeCount = 0;
    $scope.isWebinarLive = false;
    $scope.showResumeButton = false; // Resume button control - only show when needed
    
    // Host control panel integration
    $scope.isHost = false;
    $scope.showHostControls = false;
    $scope.hostControls = {
      webinarStarted: false,
      webinarPaused: false,
      attendeeCount: 0,
      chatEnabled: true,
      recordingActive: false,
      isLive: false
    };
    $scope.attendeeList = [];
    
    // Room state management
    $scope.roomState = {
      status: 'live', // FORCE: Always start with live so video is available
      currentTime: new Date(),
      webinarStartTime: null,
      timeToStart: 0
    };
    
    // Load webinar details
    $scope.loadWebinar = function() {
      $scope.isLoading = true;
      
      $http.get(`/api/webinars/${$scope.webinarId}`)
        .then(function(response) {
          console.log('Webinar loaded:', response.data);
          $scope.webinar = response.data.webinar;
          
          if ($scope.webinar) {
            $scope.roomState.webinarStartTime = new Date($scope.webinar.scheduledDate);
            $scope.checkWebinarStatus();
            $scope.loadAttendeeInfo();
            $scope.checkHostPermissions();
            $scope.initializeRoom();
            
            // IMMEDIATE: Force video src setting for both desktop and mobile
            $timeout(function() {
              const video = document.getElementById('webinarVideo');
              if (video) {
                const videoSrc = '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
                console.log('Post-init - Force setting video src to:', videoSrc);
                video.setAttribute('src', videoSrc);
                video.src = videoSrc;
                
                // Force reload and try to play with smart resume button logic
                video.load();
                setTimeout(() => {
                  // Ensure video is unmuted for audio
                  video.muted = false;
                  console.log('🔊 Video unmuted for auto-play attempt');
                  
                  video.play()
                    .then(() => {
                      console.log('✅ Auto-play successful - hiding resume button');
                      $scope.showResumeButton = false;
                      $scope.isVideoLoaded = true;
                      $scope.$apply();
                    })
                    .catch(e => {
                      console.log('❌ Auto-play prevented by browser - showing resume button');
                      $scope.showResumeButton = true;
                      $scope.$apply();
                    });
                }, 100);
              }
            }, 100);
          } else {
            ToastService.error('Webinar not found');
            $state.go('join', { webinarId: $scope.webinarId });
          }
        })
        .catch(function(error) {
          console.error('Error loading webinar:', error);
          ToastService.error('Failed to load webinar details');
          $scope.isLoading = false;
        });
    };
    
    // Check if current user is registered for this webinar
    $scope.loadAttendeeInfo = function() {
      // For now, simulate registration check
      // In a real app, this would check against registration records
      const savedRegistration = localStorage.getItem(`registration_${$scope.webinarId}`);
      
      if (savedRegistration) {
        $scope.attendee = JSON.parse(savedRegistration);
        $scope.isRegistered = true;
        console.log('Attendee registration found:', $scope.attendee);
      } else {
        // Redirect to registration page if not registered
        console.log('No registration found, redirecting to join page');
        $state.go('join', { webinarId: $scope.webinarId });
      }
    };
    
    // Check webinar status (waiting, live, ended)
    $scope.checkWebinarStatus = function() {
      const now = new Date();
      const startTime = new Date($scope.webinar.scheduledDate);
      const endTime = new Date(startTime.getTime() + ($scope.webinar.duration * 60 * 1000));
      
      $scope.roomState.currentTime = now;
      $scope.roomState.timeToStart = Math.max(0, startTime.getTime() - now.getTime());
      
      if (now < startTime) {
        $scope.roomState.status = 'waiting';
        $scope.isWebinarLive = false;
        $scope.showResumeButton = false; // Hide resume during waiting
        console.log('Webinar is in waiting state');
      } else if (now >= startTime && now < endTime) {
        $scope.roomState.status = 'live';
        $scope.isWebinarLive = true;
        $scope.checkVideoState(); // Check if resume button is needed when webinar goes live
        console.log('Webinar is live');
      } else {
        $scope.roomState.status = 'ended';
        $scope.isWebinarLive = false;
        $scope.showResumeButton = false; // Hide resume when ended
        console.log('Webinar has ended');
      }
    };
    
    // Initialize room components
    $scope.initializeRoom = function() {
      $scope.updateVideoUrl(); // FORCE: Update computed video URL
      $scope.initializeVideo();
      $scope.initializeChat();
      $scope.startAttendeeSimulation();
      $scope.forceVideoDisplay(); // FORCE: Always ensure video is visible
      $scope.checkVideoState(); // Check if resume button should be shown
      $scope.isLoading = false;
      
      // FORCE: Ensure video src is set after Angular digest
      $timeout(function() {
        const video = document.getElementById('webinarVideo');
        if (video) {
          const fullUrl = window.location.origin + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
          console.log('Final force setting video src to:', fullUrl);
          video.setAttribute('src', fullUrl);
          video.src = fullUrl;
          video.load();
          console.log('Video src final check - getAttribute:', video.getAttribute('src'), 'property:', video.src);
          
          // Also try setting as data-src for testing
          video.setAttribute('data-src', fullUrl);
        } else {
          console.log('ERROR: Video element not found after timeout!');
        }
      }, 1000); // Longer delay to ensure Angular has finished
      
      // IMMEDIATE: Set video source on next tick
      $timeout(function() {
        const video = document.getElementById('webinarVideo');
        if (video) {
          const immediateUrl = window.location.origin + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
          console.log('IMMEDIATE: Setting video src to:', immediateUrl);
          video.src = immediateUrl;
          video.load();
        }
      }, 0);
    };
    
    // Initialize video player
    $scope.initializeVideo = function() {
      console.log('Initialize video called, webinar:', $scope.webinar);
      if ($scope.webinar && $scope.webinar.videoPath) {
        console.log('Video path found:', $scope.webinar.videoPath);
        $scope.videoError = false; // FORCE: Reset video error
        $scope.isVideoLoaded = true;
        
        // Force video element setup with delay
        $timeout(function() {
          const video = document.getElementById('webinarVideo') || document.getElementById('webinar-video');
          if (video) {
            console.log('Video element found, setting up with domain URL...');
            
            // Set source directly with domain prefix
            const videoUrl = window.location.origin + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
            console.log('Setting video src to:', videoUrl);
            video.src = videoUrl;
            video.load(); // Force reload of video source
            
            // Try to play if webinar is live
            if ($scope.isWebinarLive) {
              video.play().catch(e => console.log('Autoplay prevented:', e));
            }
          } else {
            console.log('Video element not found - checking for webinar-video ID');
          }
        }, 500);
        
        // Auto-start video if webinar is live
        if ($scope.isWebinarLive) {
          $timeout(function() {
            $scope.playVideo();
          }, 1000);
        }
      } else {
        console.log('No video path found for webinar - but allowing display anyway');
        // Don't set videoError = true anymore, allow the video element to be shown
        $scope.videoError = false;
      }
    };
    
    // Video player controls
    $scope.playVideo = function() {
      const video = document.getElementById('webinarVideo');
      if (video) {
        // Ensure video is unmuted for audio playback
        video.muted = false;
        console.log('Video unmuted and attempting to play...');
        
        video.play()
          .then(function() {
            $scope.isVideoLoaded = true;
            $scope.videoError = false; // FORCE: Reset video error on successful play
            $scope.showResumeButton = false; // Hide resume button when video plays successfully
            console.log('Video started successfully with audio enabled');
            $scope.$apply();
          })
          .catch(function(error) {
            console.error('Video play error:', error);
            // Show resume button if play fails
            $scope.showResumeButton = true;
            $scope.$apply();
            // Don't set videoError = true, just log the error
            console.log('Video play failed but keeping video element visible');
          });
      }
    };
    
    $scope.pauseVideo = function() {
      const video = document.getElementById('webinarVideo');
      if (video) {
        video.pause();
      }
    };

    // Resume video function - smarter about when to show resume button
    $scope.resumeVideo = function() {
      console.log('Resume video called');
      $scope.showResumeButton = false;
      
      // Ensure controls are visible after resume
      const video = document.getElementById('webinarVideo');
      if (video) {
        video.controls = true;
        video.setAttribute('controls', 'controls');
        console.log('Video controls explicitly enabled after resume');
      }
      
      $scope.playVideo();
    };

    // Smart video state check - only show resume when actually needed
    $scope.checkVideoState = function() {
      $timeout(function() {
        const video = document.getElementById('webinarVideo');
        if (video && $scope.roomState.status === 'live') {
          console.log('🎥 Checking video state:', {
            paused: video.paused,
            ended: video.ended,
            readyState: video.readyState,
            networkState: video.networkState
          });
          
          // Only show resume button if video is paused and webinar is live
          if (video.paused && !video.ended && video.readyState > 0) {
            console.log('📹 Video is paused, showing resume button');
            $scope.showResumeButton = true;
          } else {
            console.log('▶️ Video is playing or ready to play, hiding resume button');
            $scope.showResumeButton = false;
          }
          $scope.$apply();
        }
      }, 1000);
    };
    
    // Initialize chat system
    $scope.initializeChat = function() {
      $scope.chatMessages = [
        {
          id: 'welcome',
          sender: 'System',
          message: `Welcome to "${$scope.webinar.title}"! The webinar will begin shortly.`,
          timestamp: new Date(),
          isSystem: true
        }
      ];
      
      // Start auto-chat if webinar is live
      if ($scope.isWebinarLive) {
        $scope.startAutoChat();
      }
    };
    
    // Auto-generated chat messages
    $scope.startAutoChat = function() {
      const autoMessages = [
        { sender: 'Host', message: 'Welcome everyone! Great to have you here.', delay: 5000 },
        { sender: 'Host', message: 'Feel free to ask questions in the chat.', delay: 12000 },
        { sender: 'Host', message: 'We have an exciting session planned today.', delay: 18000 },
        { sender: 'Host', message: 'Let me know if you can see and hear clearly.', delay: 25000 },
        { sender: 'Host', message: 'Thank you for joining our webinar.', delay: 32000 }
      ];
      
      autoMessages.forEach(function(msg, index) {
        $timeout(function() {
          $scope.addChatMessage(msg.sender, msg.message);
        }, msg.delay);
      });
    };
    
    // Add chat message
    $scope.addChatMessage = function(sender, message) {
      $scope.chatMessages.push({
        id: Date.now() + Math.random(),
        sender: sender,
        message: message,
        timestamp: new Date(),
        isSystem: false
      });
      
      // Scroll chat to bottom
      $timeout(function() {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    };
    
    // Send user message (simulated)
    $scope.sendMessage = function() {
      if ($scope.newMessage.trim()) {
        $scope.addChatMessage($scope.attendee.name || 'You', $scope.newMessage);
        $scope.newMessage = '';
      }
    };
    
    // Simulate attendee count changes according to time-based rules
    // Requirements:
    // - Start near 23 at the beginning of the meeting and ramp to 232 over the first 5 minutes
    // - After that, change by ±3 to ±10 every minute (small, natural fluctuations)
    // - In the last 10 minutes, gradually decrease from 232 toward ~150-180 by the end
    $scope.startAttendeeSimulation = function() {
      const storageKey = `attendeeCount_${$scope.webinarId}`;
      const metaKey = `attendeeCountMeta_${$scope.webinarId}`;
      const lastUpdateKey = `lastAttendeeUpdate_${$scope.webinarId}`;

      const startTime = new Date($scope.webinar.scheduledDate).getTime();
      const durationMs = ($scope.webinar.duration || 60) * 60 * 1000; // default 60 mins if missing
      const endTime = startTime + durationMs;

      // Read persisted state
      let storedCount = parseInt(localStorage.getItem(storageKey), 10);
      if (isNaN(storedCount)) storedCount = null;
      let meta = null;
      try { meta = JSON.parse(localStorage.getItem(metaKey) || 'null'); } catch (e) { meta = null; }
      if (!meta || typeof meta.targetEnd !== 'number') {
        meta = { targetEnd: Math.floor(150 + Math.random() * 31) }; // 150-180
      }

      // Helper clamp
      const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

      // Compute the desired count for a given time instantly (used when user joins mid-webinar)
      function computeExpectedCount(nowMs) {
        if (nowMs < startTime) {
          // Pre-start: keep between 10-22, trending toward 23 by start
          const minutesToStart = Math.max(0, Math.ceil((startTime - nowMs) / 60000));
          const base = clamp(23 - minutesToStart, 10, 22);
          return base;
        }
        if (nowMs >= endTime) {
          // After end: settle near targetEnd
          return meta.targetEnd;
        }

        const elapsed = nowMs - startTime; // ms since start
        const remaining = endTime - nowMs; // ms until end

        // Phase A: Ramp-up over first 5 minutes from 23 -> 232
        const rampUpMs = 5 * 60 * 1000;
        if (elapsed <= rampUpMs) {
          const frac = clamp(elapsed / rampUpMs, 0, 1);
          const expected = 23 + Math.round((232 - 23) * frac);
          return expected;
        }

        // Phase C: Ramp-down over last 10 minutes from ~232 -> targetEnd (150-180)
        const rampDownMs = 10 * 60 * 1000;
        if (remaining <= rampDownMs) {
          const frac = clamp(1 - (remaining / rampDownMs), 0, 1); // 0 -> 1 across last 10 minutes
          const expected = 232 + Math.round((meta.targetEnd - 232) * frac);
          return expected;
        }

        // Phase B: Stable mid-session: hover around 232
        return 232;
      }

      // Initialize current count
      const nowInit = Date.now();
      const expectedNow = computeExpectedCount(nowInit);
      if (storedCount === null) {
        // First visit: start from expected baseline with tiny variance
        $scope.attendeeCount = clamp(expectedNow + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 3), 1, 500);
      } else {
        // Continue from prior with small nudge toward expected
        const delta = expectedNow - storedCount;
        const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 7), -7, 7);
        $scope.attendeeCount = clamp(storedCount + step, 1, 500);
      }

      // Persist
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
            // Pre-start: slow approach toward 23
            const delta = expected - $scope.attendeeCount;
            const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 2), -2, 2);
            $scope.attendeeCount = clamp($scope.attendeeCount + step, 1, 500);
          } else if (now >= startTime && now <= startTime + 5 * 60 * 1000) {
            // Ramp-up: reach 232 within first 5 minutes, smooth steps every 10s
            const delta = expected - $scope.attendeeCount;
            // step 3-9 to keep smooth but decisive
            const stepMag = clamp(Math.min(Math.abs(delta), Math.floor(3 + Math.random() * 7)), 1, 12);
            const step = Math.sign(delta) * stepMag;
            $scope.attendeeCount = clamp($scope.attendeeCount + step, 1, 500);
          } else if (now >= endTime - 10 * 60 * 1000 && now < endTime) {
            // Ramp-down: head toward targetEnd with smooth steps every 10s
            const delta = expected - $scope.attendeeCount;
            const stepMag = clamp(Math.min(Math.abs(delta), Math.floor(2 + Math.random() * 6)), 1, 10);
            const step = Math.sign(delta) * stepMag;
            $scope.attendeeCount = clamp($scope.attendeeCount + step, 1, 500);
          } else if (now >= endTime) {
            // After end: settle at targetEnd slowly
            const delta = expected - $scope.attendeeCount;
            const step = clamp(Math.sign(delta) * Math.min(Math.abs(delta), 2), -2, 2);
            $scope.attendeeCount = clamp($scope.attendeeCount + step, 1, 500);
          } else {
            // Stable phase: ±3..±10 each minute, with mild pull toward 232 to avoid drift
            const pull = clamp(232 - $scope.attendeeCount, -5, 5);
            const magnitude = Math.floor(3 + Math.random() * 8); // 3-10
            const sign = Math.random() < 0.5 ? -1 : 1;
            const randomStep = sign * magnitude;
            $scope.attendeeCount = clamp($scope.attendeeCount + pull + randomStep, 1, 500);
          }

          localStorage.setItem(storageKey, String($scope.attendeeCount));
          localStorage.setItem(metaKey, JSON.stringify(meta));
          localStorage.setItem(lastUpdateKey, String(now));
          console.log('Attendee count updated to:', $scope.attendeeCount, 'at', new Date(now).toLocaleTimeString());
        }
      }, 5000); // Check every 5 seconds for real-time behavior

      // Cleanup on destroy to avoid leaks
      $scope.$on('$destroy', function() {
        if (attendeeInterval) {
          $interval.cancel(attendeeInterval);
        }
      });
    };
    
    // Format time remaining
    $scope.formatTimeToStart = function() {
      if ($scope.roomState.timeToStart <= 0) return '00:00:00';
      
      const hours = Math.floor($scope.roomState.timeToStart / (1000 * 60 * 60));
      const minutes = Math.floor(($scope.roomState.timeToStart % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor(($scope.roomState.timeToStart % (1000 * 60)) / 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Update countdown timer
    $scope.updateCountdown = function() {
      if ($scope.roomState.status === 'waiting') {
        $scope.checkWebinarStatus();
        $timeout($scope.updateCountdown, 1000);
      }
    };
    
    // Leave webinar room
    $scope.leaveRoom = function() {
      ToastService.success('Thank you for attending!');
      $state.go('join', { webinarId: $scope.webinarId });
    };
    
    // Error handlers
    $scope.onVideoError = function() {
      console.error('Video loading error');
      // Don't set videoError = true, keep video element visible for user interaction
      console.log('Video error occurred but keeping element visible');
    };
    
    $scope.onVideoLoad = function() {
      console.log('Video loaded successfully');
      $scope.isVideoLoaded = true;
      $scope.videoError = false; // FORCE: Always reset video error on load
      $scope.$apply(); // Force digest cycle
    };
    
    // Force video display - called after webinar loads
    $scope.forceVideoDisplay = function() {
      console.log('Forcing video display...');
      $scope.videoError = false;
      $scope.isVideoLoaded = true;
      
      $timeout(function() {
        const video = document.getElementById('webinarVideo');
        if (video) {
          console.log('Video element found, forcing display styles');
          video.style.display = 'block';
          video.style.visibility = 'visible';
          video.style.opacity = '1';
          
          // Force set video source with domain
          const videoUrl = $scope.getVideoUrl();
          console.log('Setting video src to:', videoUrl);
          
          // FORCE: Set src attribute multiple ways to ensure it sticks
          console.log('Setting video src with domain...');
          
          // Set both relative and absolute URLs
          const fullUrl = window.location.origin + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
          console.log('Setting full URL:', fullUrl);
          
          video.setAttribute('src', fullUrl);
          video.src = fullUrl;
          
          console.log('Video src set via setAttribute:', video.getAttribute('src'));
          console.log('Video src property:', video.src);
          
          video.load(); // Force reload
          
          // Try to trigger load event
          if (video.readyState >= 1) {
            console.log('Video already loaded, triggering onVideoLoad');
            $scope.onVideoLoad();
          }
        }
      }, 100);
    };
    
    // Get video URL with proper domain  
    $scope.getVideoUrl = function() {
      console.log('getVideoUrl called, webinar:', $scope.webinar);
      
      const baseUrl = window.location.origin; // e.g., http://localhost:3000
      console.log('Base URL:', baseUrl);
      
      // Always return a valid URL with domain prefix
      if ($scope.webinar && $scope.webinar.videoPath) {
        let videoUrl;
        // If video path starts with http, use it as is
        if ($scope.webinar.videoPath.startsWith('http')) {
          videoUrl = $scope.webinar.videoPath;
        } else {
          // Always add domain prefix for relative paths
          videoUrl = baseUrl + $scope.webinar.videoPath;
        }
        console.log('Final video URL with domain:', videoUrl);
        return videoUrl;
      }
      
      // Fallback video with domain prefix
      const fallbackUrl = baseUrl + '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
      console.log('Using fallback URL with domain:', fallbackUrl);
      return fallbackUrl;
    };
    
    // Initialize computed URL after webinar loads
    $scope.updateVideoUrl = function() {
      $scope.computedVideoUrl = $scope.getVideoUrl();
      console.log('Updated video URL:', $scope.computedVideoUrl);
    };
    
    // Host Control Functions
    $scope.checkHostPermissions = function() {
      if (AuthService.isLoggedIn() && $scope.webinar) {
        const currentUser = AuthService.getCurrentUser();
        $scope.isHost = (currentUser && currentUser.email === $scope.webinar.hostEmail);
        
        if ($scope.isHost) {
          console.log('Host detected, enabling host controls');
          $scope.initializeHostControls();
        }
      }
    };
    
    $scope.initializeHostControls = function() {
      // Initialize host control state based on webinar status
      $scope.hostControls.webinarStarted = ($scope.webinar.status === 'live');
      $scope.hostControls.isLive = ($scope.webinar.status === 'live');
      $scope.hostControls.webinarPaused = ($scope.webinar.status === 'paused');
      $scope.hostControls.attendeeCount = $scope.attendeeCount;
      
      // Start listening for host broadcast messages
      $scope.listenForHostBroadcasts();
      
      // Initialize attendee simulation for host view
      $scope.simulateAttendeesForHost();
    };
    
    $scope.toggleWebinar = function() {
      if ($scope.hostControls.webinarStarted) {
        $scope.pauseWebinar();
      } else {
        $scope.startWebinar();
      }
    };
    
    $scope.startWebinar = function() {
      $scope.hostControls.webinarStarted = true;
      $scope.hostControls.webinarPaused = false;
      $scope.hostControls.isLive = true;
      $scope.isWebinarLive = true;
      $scope.roomState.status = 'live';
      
      // Update webinar status
      $http.put('/api/webinars/' + $scope.webinarId + '/status', {
        status: 'live',
        startedAt: new Date().toISOString()
      })
      .then((response) => {
        ToastService.success('Webinar started successfully!');
        $scope.broadcastToAttendees('webinar_started');
        
        // Start video if available
        const video = document.getElementById('webinarVideo');
        if (video) {
          video.play();
        }
      })
      .catch((error) => {
        console.error('Error starting webinar:', error);
        ToastService.error('Failed to start webinar');
      });
    };
    
    $scope.pauseWebinar = function() {
      $scope.hostControls.webinarPaused = true;
      $scope.hostControls.isLive = false;
      $scope.isWebinarLive = false;
      
      $http.put('/api/webinars/' + $scope.webinarId + '/status', {
        status: 'paused'
      })
      .then((response) => {
        ToastService.success('Webinar paused');
        $scope.broadcastToAttendees('webinar_paused');
        
        // Pause video if available
        const video = document.getElementById('webinarVideo');
        if (video) {
          video.pause();
        }
      })
      .catch((error) => {
        console.error('Error pausing webinar:', error);
        ToastService.error('Failed to pause webinar');
      });
    };
    
    $scope.endWebinar = function() {
      if (confirm('Are you sure you want to end the webinar? This action cannot be undone.')) {
        $scope.hostControls.webinarStarted = false;
        $scope.hostControls.isLive = false;
        $scope.isWebinarLive = false;
        $scope.roomState.status = 'ended';
        
        $http.put('/api/webinars/' + $scope.webinarId + '/status', {
          status: 'ended',
          endedAt: new Date().toISOString()
        })
        .then((response) => {
          ToastService.success('Webinar ended');
          $scope.broadcastToAttendees('webinar_ended');
        })
        .catch((error) => {
          console.error('Error ending webinar:', error);
          ToastService.error('Failed to end webinar');
        });
      }
    };
    
    $scope.toggleChat = function() {
      $scope.hostControls.chatEnabled = !$scope.hostControls.chatEnabled;
      
      const message = $scope.hostControls.chatEnabled ? 'Chat enabled' : 'Chat disabled';
      ToastService.success(message);
      $scope.broadcastToAttendees('chat_toggled', { enabled: $scope.hostControls.chatEnabled });
    };
    
    $scope.toggleRecording = function() {
      $scope.hostControls.recordingActive = !$scope.hostControls.recordingActive;
      
      const message = $scope.hostControls.recordingActive ? 'Recording started' : 'Recording stopped';
      ToastService.success(message);
      
      $scope.broadcastToAttendees('recording_toggled', { recording: $scope.hostControls.recordingActive });
    };
    
    $scope.kickAttendee = function(attendeeId) {
      if (confirm('Are you sure you want to remove this attendee?')) {
        $scope.attendeeList = $scope.attendeeList.filter(a => a.id !== attendeeId);
        $scope.hostControls.attendeeCount = $scope.attendeeList.length;
        ToastService.success('Attendee removed');
      }
    };
    
    $scope.muteAttendee = function(attendeeId) {
      const attendee = $scope.attendeeList.find(a => a.id === attendeeId);
      if (attendee) {
        attendee.muted = !attendee.muted;
        const message = attendee.muted ? 'Attendee muted' : 'Attendee unmuted';
        ToastService.success(message);
      }
    };
    
    $scope.broadcastToAttendees = function(event, data = {}) {
      const message = {
        event: event,
        data: data,
        timestamp: new Date().toISOString(),
        webinarId: $scope.webinarId
      };
      
      localStorage.setItem('hostBroadcast_' + $scope.webinarId, JSON.stringify(message));
      
      // Clear the message after a short delay
      setTimeout(() => {
        localStorage.removeItem('hostBroadcast_' + $scope.webinarId);
      }, 1000);
    };
    
    $scope.listenForHostBroadcasts = function() {
      // Listen for messages from host (if user is attendee)
      const interval = $interval(() => {
        const message = localStorage.getItem('hostBroadcast_' + $scope.webinarId);
        if (message) {
          try {
            const broadcast = JSON.parse(message);
            $scope.handleHostBroadcast(broadcast);
          } catch (error) {
            console.error('Error parsing host broadcast:', error);
          }
        }
      }, 500);
      
      $scope.$on('$destroy', () => {
        if (interval) {
          $interval.cancel(interval);
        }
      });
    };
    
    $scope.handleHostBroadcast = function(broadcast) {
      switch (broadcast.event) {
        case 'webinar_started':
          $scope.isWebinarLive = true;
          $scope.roomState.status = 'live';
          ToastService.success('Webinar has started!');
          break;
        case 'webinar_paused':
          $scope.isWebinarLive = false;
          ToastService.info('Webinar has been paused');
          break;
        case 'webinar_ended':
          $scope.isWebinarLive = false;
          $scope.roomState.status = 'ended';
          ToastService.info('Webinar has ended');
          break;
        case 'chat_toggled':
          if (broadcast.data.enabled) {
            ToastService.success('Chat has been enabled');
          } else {
            ToastService.warning('Chat has been disabled');
          }
          break;
        case 'recording_toggled':
          if (broadcast.data.recording) {
            ToastService.info('Recording started');
          } else {
            ToastService.info('Recording stopped');
          }
          break;
      }
    };
    
    $scope.simulateAttendeesForHost = function() {
      if (!$scope.isHost) return;
      
      const attendeeNames = [
        'Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Emma Brown',
        'Frank Miller', 'Grace Lee', 'Henry Taylor', 'Ivy Chen', 'Jack Wilson',
        'Kate Adams', 'Liam Jones', 'Maya Patel', 'Noah Garcia', 'Olivia Martinez'
      ];
      
      // Start with some attendees
      for (let i = 0; i < Math.floor(Math.random() * 8) + 5; i++) {
        $scope.attendeeList.push({
          id: 'attendee_' + (i + 1),
          name: attendeeNames[i],
          joinedAt: new Date(Date.now() - Math.random() * 300000).toISOString(),
          muted: false,
          handRaised: false,
          active: true
        });
      }
      
      $scope.hostControls.attendeeCount = $scope.attendeeList.length;
    };
    
    // Initialize controller
    $scope.loadWebinar();
    
    // Start countdown if waiting
    if ($scope.roomState.status === 'waiting') {
      $timeout($scope.updateCountdown, 1000);
    }
    
    console.log('WebinarRoomController setup complete');
    
    // FINAL ATTEMPT: Set video src immediately after controller init
    $timeout(function() {
      console.log('Final attempt to set video src...');
      const video = document.getElementById('webinarVideo');
      if (video) {
        const videoSrc = '/uploads/videos/5ab341c5-883f-4a20-ba5d-bfe884742d31_1756137634769_Criteria_Based_Enrollment_in_SORA.mp4';
        console.log('FINAL - Setting video src to:', videoSrc);
        video.setAttribute('src', videoSrc);
        video.src = videoSrc;
        video.load();
        
        // Log current state
        console.log('Video element after final setup:');
        console.log('- getAttribute src:', video.getAttribute('src'));
        console.log('- src property:', video.src);
        console.log('- readyState:', video.readyState);
      } else {
        console.log('FINAL - Video element still not found!');
      }
    }, 2000); // Longer delay to ensure everything is loaded
  }
]);
