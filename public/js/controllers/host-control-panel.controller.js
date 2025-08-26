// Host Control Panel Controller
angular.module('webinarApp')
.controller('HostControlPanelController', ['$scope', '$http', '$stateParams', 'AuthService', 'ToastService', '$interval',
  function($scope, $http, $stateParams, AuthService, ToastService, $interval) {
    
    // Get webinar ID from URL
    const webinarId = $stateParams.webinarId;
    
    // Control panel data
    $scope.isHost = false;
    $scope.isLoading = true;
    $scope.webinar = null;
    $scope.hostControls = {
      webinarStarted: false,
      webinarPaused: false,
      attendeeCount: 0,
      chatEnabled: true,
      recordingActive: false,
      isLive: false
    };
    
    // Host control functions
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
      
      // Update webinar status
      $http.put('/api/webinars/' + webinarId + '/status', {
        status: 'live',
        startedAt: new Date().toISOString()
      })
      .then((response) => {
        ToastService.success('Webinar started successfully!');
        $scope.broadcastToAttendees('webinar_started');
      })
      .catch((error) => {
        console.error('Error starting webinar:', error);
        ToastService.error('Failed to start webinar');
      });
    };
    
    $scope.pauseWebinar = function() {
      $scope.hostControls.webinarPaused = true;
      $scope.hostControls.isLive = false;
      
      $http.put('/api/webinars/' + webinarId + '/status', {
        status: 'paused'
      })
      .then((response) => {
        ToastService.success('Webinar paused');
        $scope.broadcastToAttendees('webinar_paused');
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
        
        $http.put('/api/webinars/' + webinarId + '/status', {
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
      
      $http.put('/api/webinars/' + webinarId + '/chat-settings', {
        chatEnabled: $scope.hostControls.chatEnabled
      })
      .then((response) => {
        const message = $scope.hostControls.chatEnabled ? 'Chat enabled' : 'Chat disabled';
        ToastService.success(message);
        $scope.broadcastToAttendees('chat_toggled', { enabled: $scope.hostControls.chatEnabled });
      })
      .catch((error) => {
        console.error('Error toggling chat:', error);
        ToastService.error('Failed to update chat settings');
      });
    };
    
    $scope.toggleRecording = function() {
      $scope.hostControls.recordingActive = !$scope.hostControls.recordingActive;
      
      const message = $scope.hostControls.recordingActive ? 'Recording started' : 'Recording stopped';
      ToastService.success(message);
      
      $scope.broadcastToAttendees('recording_toggled', { recording: $scope.hostControls.recordingActive });
    };
    
    // Attendee management
    $scope.attendeeList = [];
    $scope.kickAttendee = function(attendeeId) {
      if (confirm('Are you sure you want to remove this attendee?')) {
        // Simulate attendee removal
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
    
    // Broadcast functions to communicate with attendee room
    $scope.broadcastToAttendees = function(event, data = {}) {
      // This would use WebSocket in a real implementation
      // For now, we'll use localStorage as a simple communication method
      const message = {
        event: event,
        data: data,
        timestamp: new Date().toISOString(),
        webinarId: webinarId
      };
      
      localStorage.setItem('hostBroadcast_' + webinarId, JSON.stringify(message));
      
      // Clear the message after a short delay
      setTimeout(() => {
        localStorage.removeItem('hostBroadcast_' + webinarId);
      }, 1000);
    };
    
    // Initialize host verification and webinar data
    $scope.initializeHostPanel = function() {
      // Verify host permission
      if (!AuthService.isLoggedIn() || !AuthService.isHost()) {
        ToastService.error('Host access required');
        $state.go('login');
        return;
      }
      
      // Load webinar data
      $http.get('/api/webinars/' + webinarId)
        .then((response) => {
          $scope.webinar = response.data;
          $scope.isHost = (AuthService.getCurrentUser().email === $scope.webinar.hostEmail);
          
          if (!$scope.isHost) {
            ToastService.error('You are not the host of this webinar');
            $state.go('dashboard');
            return;
          }
          
          // Initialize control states based on webinar status
          $scope.hostControls.webinarStarted = ($scope.webinar.status === 'live');
          $scope.hostControls.isLive = ($scope.webinar.status === 'live');
          $scope.hostControls.webinarPaused = ($scope.webinar.status === 'paused');
          
          $scope.isLoading = false;
          
          // Start attendee simulation
          $scope.simulateAttendees();
        })
        .catch((error) => {
          console.error('Error loading webinar:', error);
          ToastService.error('Failed to load webinar details');
          $scope.isLoading = false;
        });
    };
    
    // Simulate realistic attendee behavior
    $scope.simulateAttendees = function() {
      // Generate initial attendee list
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
      
      // Simulate attendees joining/leaving
      const attendeeInterval = $interval(() => {
        if (Math.random() > 0.7) {
          // Someone joins
          if ($scope.attendeeList.length < 50 && attendeeNames.length > $scope.attendeeList.length) {
            const newAttendee = {
              id: 'attendee_' + Date.now(),
              name: attendeeNames[$scope.attendeeList.length % attendeeNames.length],
              joinedAt: new Date().toISOString(),
              muted: false,
              handRaised: false,
              active: true
            };
            $scope.attendeeList.push(newAttendee);
            $scope.hostControls.attendeeCount = $scope.attendeeList.length;
          }
        } else if (Math.random() > 0.8 && $scope.attendeeList.length > 3) {
          // Someone leaves
          $scope.attendeeList.pop();
          $scope.hostControls.attendeeCount = $scope.attendeeList.length;
        }
      }, 15000);
      
      // Clean up interval when scope is destroyed
      $scope.$on('$destroy', () => {
        if (attendeeInterval) {
          $interval.cancel(attendeeInterval);
        }
      });
    };
    
    // Initialize when controller loads
    $scope.initializeHostPanel();
  }
]);
