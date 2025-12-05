import {
  NBackTop,
  NConfigProvider,
  NDialogProvider,
  NDrawer,
  NDrawerContent,
  NGlobalStyle,
  NMessageProvider,
  NNotificationProvider,
  NSpin,
  create,
} from 'naive-ui';

const naive = create({
  components: [
    NBackTop,
    NConfigProvider,
    NDialogProvider,
    NMessageProvider,
    NNotificationProvider,
    NGlobalStyle,
    NSpin,
    NDrawer,
    NDrawerContent,
  ],
});

export default naive;
