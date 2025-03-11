import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

const initialState = {
  walletConnected: false,
  selectedGameId: '',
};

const reducer = (state = initialState, action: any) => {
  switch (action.type) {
    case 'SET_WALLET_CONNECTED':
      return { ...state, walletConnected: action.payload };
    case 'SET_SELECTED_GAME':
      return { ...state, selectedGameId: action.payload };
    default:
      return state;
  }
};

export const store = configureStore({
  reducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
