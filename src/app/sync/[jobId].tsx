import { SyncErrorScreen } from '@/features/upload';
import { withSessionGate } from '@/features/personal';

export default withSessionGate(SyncErrorScreen);
