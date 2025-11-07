// lib/types/recommendation.ts - 추천 시스템 전용 타입 정의

import { Song } from './song';

// 🎯 추천 업데이트 상태 타입
export interface PendingRecommendationUpdate {
  readonly isScheduled: boolean;
  readonly countdown: number;
  readonly isCalculating: boolean;
  readonly newOrder?: readonly string[];
  readonly timeoutId?: NodeJS.Timeout;
  readonly triggeredBy?: 'rating_change' | 'manual_refresh' | 'background_return';
  readonly batchedChanges?: readonly RatingChange[];
}

// ⭐ 별점 변경 정보
export interface RatingChange {
  readonly videoId: string;
  readonly oldRating: number;
  readonly newRating: number;
  readonly timestamp: number;
  readonly userId: string;
}

// 🔄 추천 계산 결과
export interface RecommendationCalculation {
  readonly userId: string;
  readonly songIds: readonly string[];
  readonly scores: Readonly<Record<string, number>>;
  readonly metadata: {
    readonly calculationTime: number;
    readonly ratingCount: number;
    readonly algorithmVersion: string;
    readonly confidence: number;
  };
  readonly generatedAt: Date;
}

// 📊 UX 메트릭
export interface RecommendationUXMetrics {
  readonly sessionId: string;
  readonly userId: string;
  readonly events: readonly UXEvent[];
  readonly startTime: Date;
  readonly endTime?: Date;
}

export interface UXEvent {
  readonly type: 'notification_shown' | 'user_accepted' | 'user_rejected' | 'auto_applied' | 'cancelled';
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

// 🎭 애니메이션 상태
export interface AnimationState {
  readonly isVisible: boolean;
  readonly slidePosition: number;
  readonly opacity: number;
  readonly scale: number;
  readonly progress: number;
}

// 🔗 훅 반환 타입들
export interface UseSongsReturn {
  readonly songs: readonly Song[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly isUpdating: boolean;
  readonly refreshData: () => Promise<void>;
  readonly hasRecommendations: boolean;
  readonly isLoadingRecommendations: boolean;
  readonly pendingRecommendationUpdate: PendingRecommendationUpdate;
  readonly applyPendingRecommendations: () => Promise<void>;
  readonly cancelPendingRecommendations: () => void;
  readonly scheduleRecommendationUpdate: (delay?: number) => void;
  readonly _internal: {
    readonly setOnRatingChangeCallback: (callback: RatingChangeCallback) => void;
    readonly onRatingChanged: RatingChangeCallback;
  };
}

export interface UseRatingsReturn {
  readonly ratings: Readonly<Record<string, number>>;
  readonly setRating: (videoId: string, rating: number) => void;
  readonly getRating: (videoId: string) => number;
  readonly loading: boolean;
  readonly isSyncing: boolean;
  readonly lastSyncTime: number;
  readonly forceSyncFromCloud: () => Promise<void>;
  readonly setOnRatingChangeCallback: (callback: RatingChangeCallback | null) => void;
}

// 📞 콜백 타입들
export type RatingChangeCallback = (
  videoId: string, 
  newRating: number, 
  oldRating: number
) => void;

export type RecommendationApplyCallback = (
  newOrder: readonly string[]
) => Promise<void>;

// 🎨 컴포넌트 Props 타입들
export interface RecommendationUpdateBarProps {
  readonly isVisible: boolean;
  readonly isCalculating: boolean;
  readonly countdown: number;
  readonly hasNewOrder: boolean;
  readonly estimatedSongs?: number;
  readonly onApply: () => void;
  readonly onCancel: () => void;
  readonly theme?: 'light' | 'dark' | 'auto';
  readonly position?: 'top' | 'bottom';
  readonly animationDuration?: number;
}

// 🔧 설정 타입들
export interface RecommendationConfig {
  readonly notificationDelay: number;
  readonly autoApplyThreshold: number;
  readonly enableBatchProcessing: boolean;
  readonly maxBatchSize: number;
  readonly enableBackgroundUpdates: boolean;
  readonly enableHapticFeedback: boolean;
  readonly enableSoundFeedback: boolean;
  readonly accessibilityMode: boolean;
}

// 🌍 다국어 지원
export interface LocalizedStrings {
  readonly notification: {
    readonly title: string;
    readonly subtitle: string;
    readonly calculating: string;
    readonly ready: string;
  };
  readonly buttons: {
    readonly apply: string;
    readonly cancel: string;
    readonly later: string;
  };
  readonly accessibility: {
    readonly notificationBar: string;
    readonly applyButton: string;
    readonly cancelButton: string;
    readonly progressBar: string;
  };
}

// 🚨 에러 타입들
export class RecommendationError extends Error {
  constructor(
    message: string,
    public readonly code: RecommendationErrorCode,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

export enum RecommendationErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CALCULATION_FAILED = 'CALCULATION_FAILED',
  INVALID_USER_ID = 'INVALID_USER_ID',
  CACHE_ERROR = 'CACHE_ERROR',
  TIMEOUT = 'TIMEOUT',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  FIREBASE_ERROR = 'FIREBASE_ERROR'
}

// 🧪 테스트 헬퍼 타입들
export interface MockRecommendationService {
  readonly getUserRecommendations: jest.Mock;
  readonly generateUserRecommendations: jest.Mock;
  readonly refreshRecommendations: jest.Mock;
  readonly clearRecommendationsCache: jest.Mock;
}

export interface TestScenario {
  readonly name: string;
  readonly description: string;
  readonly setup: () => Promise<void>;
  readonly execute: () => Promise<void>;
  readonly verify: () => Promise<boolean>;
  readonly cleanup: () => Promise<void>;
}