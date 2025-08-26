// Admin Controller
angular.module('webinarApp')
.controller('AdminController', ['$scope', '$http', 'AuthService', 'ToastService',
  function($scope, $http, AuthService, ToastService) {
    
    // Current user
    $scope.currentUser = AuthService.getCurrentUser();
    
    // Data
    $scope.pendingHosts = [];
    $scope.allUsers = [];
    $scope.stats = {
      pendingHosts: 0,
      approvedHosts: 0,
      totalWebinars: 0,
      totalUsers: 0
    };
    
    // UI State
    $scope.isLoading = false;
    $scope.showModal = false;
    $scope.selectedHost = null;
    $scope.isApproving = false;
    
    // Approval form
    $scope.approvalForm = {
      expiryDate: null
    };
    
    // Initialize
    $scope.init = function() {
      $scope.loadPendingHosts();
      $scope.loadAllUsers();
      $scope.loadStats();
    };
    
    // Load pending hosts
    $scope.loadPendingHosts = function() {
      $scope.isLoading = true;
      
      $http.get('/api/users/pending')
        .then((response) => {
          $scope.pendingHosts = response.data || [];
          $scope.updateStats();
        })
        .catch((error) => {
          console.error('Error loading pending hosts:', error);
          ToastService.error('Failed to load pending hosts');
        })
        .finally(() => {
          $scope.isLoading = false;
        });
    };
    
    // Load all users
    $scope.loadAllUsers = function() {
      $http.get('/api/users')
        .then((response) => {
          $scope.allUsers = response.data || [];
          $scope.updateStats();
        })
        .catch((error) => {
          console.error('Error loading users:', error);
          ToastService.error('Failed to load users');
        });
    };
    
    // Load stats
    $scope.loadStats = function() {
      $http.get('/api/admin/stats')
        .then((response) => {
          $scope.stats = response.data || $scope.stats;
        })
        .catch((error) => {
          console.error('Error loading stats:', error);
          // Use calculated stats if API fails
          $scope.updateStats();
        });
    };
    
    // Update stats from loaded data
    $scope.updateStats = function() {
      $scope.stats.pendingHosts = $scope.pendingHosts.length;
      $scope.stats.approvedHosts = $scope.allUsers.filter(u => u.status === 'approved' && u.role === 'host').length;
      $scope.stats.totalUsers = $scope.allUsers.length;
      // Total webinars will be loaded from API later
    };
    
    // Show approval modal
    $scope.showApprovalModal = function(host) {
      $scope.selectedHost = host;
      $scope.approvalForm.expiryDate = null;
      $scope.showModal = true;
    };
    
    // Close modal
    $scope.closeModal = function() {
      $scope.showModal = false;
      $scope.selectedHost = null;
      $scope.approvalForm.expiryDate = null;
    };
    
    // Approve host
    $scope.approveHost = function() {
      if (!$scope.selectedHost) return;
      
      $scope.isApproving = true;
      
      const approvalData = {
        expiryDate: $scope.approvalForm.expiryDate || null
      };
      
      $http.post(`/api/users/${$scope.selectedHost.id}/approve`, approvalData)
        .then((response) => {
          ToastService.success(`${$scope.selectedHost.name} has been approved successfully!`);
          $scope.closeModal();
          $scope.refreshPendingHosts();
          $scope.loadAllUsers();
        })
        .catch((error) => {
          console.error('Error approving host:', error);
          ToastService.error('Failed to approve host. Please try again.');
        })
        .finally(() => {
          $scope.isApproving = false;
        });
    };
    
    // Reject host
    $scope.rejectHost = function(host) {
      if (!confirm(`Are you sure you want to reject ${host.name}'s registration?`)) {
        return;
      }
      
      $http.post(`/api/users/${host.id}/reject`)
        .then((response) => {
          ToastService.success(`${host.name}'s registration has been rejected.`);
          $scope.refreshPendingHosts();
          $scope.loadAllUsers();
        })
        .catch((error) => {
          console.error('Error rejecting host:', error);
          ToastService.error('Failed to reject host. Please try again.');
        });
    };
    
    // Refresh pending hosts
    $scope.refreshPendingHosts = function() {
      $scope.loadPendingHosts();
    };
    
    // Extend user access
    $scope.extendAccess = function(user) {
      const newExpiryDate = prompt('Enter new expiry date (YYYY-MM-DD) or leave empty for unlimited:');
      
      if (newExpiryDate === null) return; // User cancelled
      
      const updateData = {
        expiryDate: newExpiryDate || null
      };
      
      $http.put(`/api/users/${user.id}/extend`, updateData)
        .then((response) => {
          ToastService.success(`Access extended for ${user.name}`);
          $scope.loadAllUsers();
        })
        .catch((error) => {
          console.error('Error extending access:', error);
          ToastService.error('Failed to extend access');
        });
    };
    
    // Delete user
    $scope.deleteUser = function(user) {
      if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
        return;
      }
      
      $http.delete(`/api/users/${user.id}`)
        .then((response) => {
          ToastService.success(`${user.name} has been deleted.`);
          $scope.loadAllUsers();
          $scope.refreshPendingHosts();
        })
        .catch((error) => {
          console.error('Error deleting user:', error);
          ToastService.error('Failed to delete user');
        });
    };
    
    // Initialize the controller
    $scope.init();
  }
]);
