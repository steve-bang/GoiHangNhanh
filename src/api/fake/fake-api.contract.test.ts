import { describeApiContract } from '../contract-tests/api.contract';

import { createFakeApi } from './fake-api';

describeApiContract('api/fake', () => createFakeApi({ latencyMs: 0 }));
