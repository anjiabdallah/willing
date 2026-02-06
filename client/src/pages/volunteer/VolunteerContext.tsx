import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { VolunteerAccount } from '../../../../server/src/db/types';
import requestServer from '../../requestServer';

type VolunteerContextType = {
  volunteer?: VolunteerAccount;
  refreshVolunteer: () => void;
  logout: () => void;
};

const VolunteerContext = createContext<VolunteerContextType>({
  volunteer: undefined,
  refreshVolunteer: () => {},
  logout: () => {},
});

export const VolunteerProvider = ({ children }: { children: ReactNode }) => {
  const [volunteer, setVolunteer] = useState<VolunteerAccount | undefined>(undefined);

  const refreshVolunteer = useCallback(() => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      setVolunteer(undefined);
      return;
    }

    requestServer<{ volunteer: VolunteerAccount }>('/volunteer/me', {}, true)
      .then(response => setVolunteer(response.volunteer))
      .catch(() => setVolunteer(undefined));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('jwt');
    setVolunteer(undefined);
  }, []);

  useEffect(() => {
    refreshVolunteer();
  }, [refreshVolunteer]);

  return (
    <VolunteerContext.Provider value={{ volunteer, refreshVolunteer, logout }}>
      {children}
    </VolunteerContext.Provider>
  );
};

export default VolunteerContext;
