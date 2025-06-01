import { renderHook, act } from '@testing-library/react'; 
import { useAuth } from '@/hooks/useAuth'; 
import { auth } from '@/lib/firebaseClient'; 

jest.mock('@/lib/firebaseClient', () => ({
  auth: {
    currentUser: null, 
    onIdTokenChanged: jest.fn(),
    getIdTokenResult: jest.fn(), 
  },
}));

let mockOnIdTokenChangedCallback: ((user: any) => Promise<void>) | null = null;

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (auth.onIdTokenChanged as jest.Mock).mockImplementation((callback) => {
      mockOnIdTokenChangedCallback = callback;
      return jest.fn(); 
    });

    (auth as any).currentUser = null;
  });

  it('should initialize with loading true and not authenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should set user and claims when auth state changes to logged-in admin', async () => {
    const mockUser = {
      uid: 'admin123',
      email: 'admin@example.com',
      getIdTokenResult: jest.fn().mockResolvedValue({
        claims: { admin: true },
        token: 'mock-token',
      }),
    };
    
    const { result, rerender } = renderHook(() => useAuth());

    if (mockOnIdTokenChangedCallback) {
      await act(async () => {
        await mockOnIdTokenChangedCallback!(mockUser);
      });
    }

    await act(async () => {
      rerender();
      await new Promise(resolve => setTimeout(resolve, 0)); 
    });
    
    if (result.current.loading) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50)); 
            rerender();
        });
    }

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(mockUser.getIdTokenResult).toHaveBeenCalled();
  });

  it('should set user and not admin when auth state changes to logged-in non-admin', async () => {
    const mockUser = {
      uid: 'user123',
      email: 'user@example.com',
      getIdTokenResult: jest.fn().mockResolvedValue({
        claims: {}, 
        token: 'mock-token',
      }),
    };

    const { result, rerender } = renderHook(() => useAuth());

    if (mockOnIdTokenChangedCallback) {
      await act(async () => {
        await mockOnIdTokenChangedCallback!(mockUser);
      });
    }

    await act(async () => {
      rerender();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    if (result.current.loading) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50)); 
            rerender();
        });
    }

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle user signing out', async () => {
    const initialMockUser = {
      uid: 'user123',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { admin: true } }),
    };

    const { result, rerender } = renderHook(() => useAuth());

    if (mockOnIdTokenChangedCallback) {
      await act(async () => {
        await mockOnIdTokenChangedCallback!(initialMockUser);
      });
    }
    await act(async () => {
      rerender(); 
      await new Promise(resolve => setTimeout(resolve, 0));
    });
     if (result.current.loading) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50)); 
            rerender();
        });
    }
    expect(result.current.isAuthenticated).toBe(true);

    if (mockOnIdTokenChangedCallback) {
      await act(async () => {
        await mockOnIdTokenChangedCallback!(null);
      });
    }
    await act(async () => {
      rerender();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle error when fetching ID token result', async () => {
    const mockUser = {
      uid: 'errorUser123',
      getIdTokenResult: jest.fn().mockRejectedValue(new Error('Token fetch failed')),
    };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result, rerender } = renderHook(() => useAuth());

    if (mockOnIdTokenChangedCallback) {
      await act(async () => {
        await mockOnIdTokenChangedCallback!(mockUser);
      });
    }

    await act(async () => {
      rerender();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    if (result.current.loading) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50)); 
            rerender();
        });
    }

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toEqual(mockUser);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error fetching custom claims:"), expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should call unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn();
    (auth.onIdTokenChanged as jest.Mock).mockImplementation((callback) => {
      mockOnIdTokenChangedCallback = callback;
      return mockUnsubscribe;
    });

    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});