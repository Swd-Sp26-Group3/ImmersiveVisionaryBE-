export const MESSAGES = {
  PROFILE: {
    PROFILE_RETRIEVED: 'Profile retrieved successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    PROFILE_NOT_FOUND: 'User profile not found',
    PROFILE_UPDATE_FAILED: 'Profile update failed',
    EMAIL_ALREADY_IN_USE: 'Email is already in use',
    UPDATE_SUCCESS: 'Update success'
  },
  VALIDATION: {
    REQUIRED_FIELDS: 'All required fields must be filled',
    INVALID_EMAIL: 'Please provide a valid email address',
    INVALID_PHONE: 'Please provide a valid phone number',
    INVALID_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    PASSWORDS_NOT_MATCH: 'Passwords do not match',
    REQUIRED_FIELD: 'This field is required',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters long',
    PASSWORD_MISMATCH: 'Passwords do not match',
    VALIDATION_ERROR: 'Validation error'
  },
  SERVICE: {
    CREATED: 'Service created successfully',
    UPDATED: 'Service updated successfully',
    DELETED: 'Service deleted successfully',
    NOT_FOUND: 'Service not found',
    SERVICE_EXISTS: 'Service already exists',
    SERVICE_NOT_FOUND: 'Service not found',
    SERVICE_CREATED: 'Service created successfully',
    SERVICE_UPDATED: 'Service updated successfully',
    SERVICE_DELETED: 'Service deleted successfully',
    SERVICES_RETRIEVED: 'Services retrieved successfully'
  },
  AUTHENTICATION: {
    LOGIN_SUCCESS: 'Login successful',
    LOGIN_FAILED: 'Invalid email or password',
    ACCOUNT_INACTIVE: 'Account is inactive',
    REGISTRATION_SUCCESS: 'Registration successful',
    REGISTRATION_FAILED: 'Registration failed',
    PASSWORD_CHANGE_SUCCESS: 'Password changed successfully',
    PASSWORD_CHANGE_FAILED: 'Incorrect old password',
    PASSWORD_TOO_WEAK: 'Password is too weak',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    INVALID_ACCESS_TOKEN: 'Invalid access token',
    LOGOUT_SUCCESS: 'Login successful'
  },
  PAYMENT: {
    PAYMENT_CHECKOUT_SUCCESS: 'Payment checkout created successfully',
    PAYMENT_NOTIFY_SUCCESS: 'Payment notification processed successfully',
    PAYMENT_VERIFY_SUCCESS: 'Payment verified successfully',
    PAYMENT_NOT_FOUND: 'Payment not found',
    INVALID_PAYMENT_SIGNATURE: 'Invalid payment signature'
  },
  TEST_REQUEST: {
    CREATED: 'Test request created successfully',
    TEST_REQUEST_CREATED: 'Test request created successfully',
    TEST_REQUEST_NOT_FOUND: 'Test request not found',
    TEST_REQUEST_RETRIEVED: 'Test request retrieved successfully',
    TEST_REQUESTS_RETRIEVED: 'Test requests retrieved successfully',
    TEST_REQUEST_CONFIRMED: 'Test request confirmed successfully',
    TEST_REQUEST_IN_PROGRESS: 'Test request marked as in progress',
    TEST_REQUEST_COMPLETED: 'Test request completed successfully',
    SAMPLE_INFO_SUBMITTED: 'Sample information submitted successfully',
    TEST_RESULTS_RETRIEVED: 'Test results retrieved successfully',
    RESULTS_NOT_AVAILABLE: 'Test results are not available yet',
    TEST_RESULT_NOT_FOUND: 'Test results not found',
    TEST_RESULT_CONFIRM: 'Confirm success'
  },
  FEEDBACK: {
    FETCH_PENDING_FAILED: 'Failed to fetch pending feedback requests',
    FETCH_SUBMITTED_FAILED: 'Failed to fetch submitted feedback',
    ALREADY_SUBMITTED: 'You have already submitted feedback for this test',
    NOT_AUTHORIZED: 'You are not authorized to submit feedback for this test',
    SUBMIT_SUCCESS: 'Feedback submitted successfully',
    SUBMIT_FAILED: 'Failed to submit feedback',
    MISSING_FIELDS: 'All fields (testResultId, rating, comment) are required',
    INVALID_RATING: 'Rating must be between 1 and 5',
    INVALID_COMMENT_LENGTH: 'Comment must be between 20 and 50 characters',
    NOT_FOUND_PENDING: 'No pending feedback requests found',
    NOT_FOUND_SUBMITTED: 'No submitted feedback found',
    PENDING_RETRIEVED: 'Pending feedback requests retrieved successfully',
    SUBMITTED_RETRIEVED: 'Submitted feedback retrieved successfully',
    Get: 'Get feedback fail',
    NOT_FOUND: 'Không tìm thấy feedback',
    UPDATE_SUCCESS: 'Cập nhật thành công',
    UPDATE_FAILED: 'Cập nhật thất bại'
  },
  FILE: {
    FILE_UPLOADED: 'File uploaded successfully',
    FILE_UPLOAD_FAILED: 'File upload failed',
    FILE_NOT_FOUND: 'File not found'
  },
  ERROR: {
    SERVER_ERROR: 'Internal server error. Please try again later',
    UNAUTHORIZED: 'Unauthorized access. Please log in first',
    NOT_FOUND: 'Resource not found',
    INVALID_TOKEN: 'Invalid token'
  },
  SUCCESS: {
    OPERATION_SUCCESS: 'Operation completed successfully',
    ACTION_PERFORMED_SUCCESS: 'Action performed successfully'
  }
}