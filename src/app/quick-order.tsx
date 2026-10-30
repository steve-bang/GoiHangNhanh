import { QuickOrderScreen } from '@/features/orders';
import { withSessionGate } from '@/features/personal';

export default withSessionGate(QuickOrderScreen);
