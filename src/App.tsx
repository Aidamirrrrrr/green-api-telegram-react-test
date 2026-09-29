import { useState } from 'react';

import ChatApp from 'components/chat-app.component';
import LoginForm from 'components/forms/login-form.component';
import { clearCredentials, loadCredentials, saveCredentials } from 'store/storage.utils';
import type { Credentials } from 'types';

function App() {
  const [saved] = useState(loadCredentials);
  const [creds, setCreds] = useState<Credentials | null>(saved);

  if (!creds) {
    return (
      <LoginForm
        initial={saved}
        onLogin={(c, remember) => {
          saveCredentials(c, remember);
          setCreds(c);
        }}
      />
    );
  }
  return (
    <ChatApp
      creds={creds}
      onLogout={() => {
        clearCredentials();
        setCreds(null);
      }}
    />
  );
}

export default App;
