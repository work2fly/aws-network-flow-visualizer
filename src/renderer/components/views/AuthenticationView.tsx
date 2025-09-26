import React from 'react';

export const AuthenticationView: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">AWS Authentication</h3>
        <p className="text-gray-600 mb-6">
          Connect to your AWS account to start analyzing network flow logs.
          Choose your preferred authentication method below.
        </p>
        
        <div className="space-y-3">
          <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Sign in with AWS SSO
          </button>
          <button className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            Use AWS Profile
          </button>
          <button className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            Assume IAM Role
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-4">
          Your credentials are stored securely and never transmitted outside of AWS API calls.
        </p>
      </div>
    </div>
  );
};