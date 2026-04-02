import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { AppProviders } from './providers';

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
