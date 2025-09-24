import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">AWS Network Flow Visualizer</h1>
      </header>
      <main className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome</h2>
          <p className="text-gray-600">
            This is the AWS Network Flow Visualizer application. The project
            structure has been set up successfully.
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
