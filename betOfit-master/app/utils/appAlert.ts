import { Alert as NativeAlert } from 'react-native';

type NativeAlertArguments = Parameters<typeof NativeAlert.alert>;
export type AppAlertConfig = {
  title: string;
  message?: string;
  buttons?: NativeAlertArguments[2];
  options?: NativeAlertArguments[3];
};

type AlertHandler = (config: AppAlertConfig) => void;

let alertHandler: AlertHandler | null = null;

export const registerAppAlertHandler = (handler: AlertHandler | null) => {
  alertHandler = handler;
};

export const AppAlert = {
  alert: (...args: NativeAlertArguments) => {
    const [title, message, buttons, options] = args;
    if (!alertHandler) {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    alertHandler({ title, message, buttons, options });
  },
};
