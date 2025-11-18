// functions/index.js
const functions = require("firebase-functions");
const { onRequest, onCall } = require("firebase-functions/v2/https");

const moment = require("moment");
const _ = require("lodash");

let admin;
let db;

function getDb() {
  if (!db) {
    admin = require("firebase-admin");
    admin.initializeApp();
    db = admin.firestore();
  }
  return db;
}

exports.generatePersonalizedRecommendations = onCall(async (request) => {
  const db = getDb();
  const data = request.data;
  const auth = request.auth;
  const startTime = Date.now();

  try {
    functions.logger.info("🚀 === 개인화 추천 함수 시작 ===");
    functions.logger.info("📥 입력 데이터:", data);
    functions.logger.info("📥 데이터 타입:", typeof data);
    functions.logger.info("📥 데이터 키들:", data ? Object.keys(data) : "null");
    functions.logger.info(
      "🔐 인증 컨텍스트:",
      auth ? "Authenticated" : "Not authenticated"
    );

    let userId;
    if (data && data.data && data.data.userId) {
      userId = data.data.userId;
      functions.logger.info("✅ 중첩된 구조에서 userId 추출", { userId });
    } else if (data && data.userId) {
      userId = data.userId;
      functions.logger.info("✅ 단순 구조에서 userId 추출", { userId });
    } else {
      functions.logger.error("❌ userId 파라미터 없음", {
        data: data,
        dataType: typeof data,
        hasData: !!(data && data.data),
        hasUserId: !!(data && data.userId),
        hasNestedUserId: !!(data && data.data && data.data.userId),
      });

      return {
        isDefault: true,
        userRatingCount: 0,
        validRatingCount: 0,
        message: "userId가 제공되지 않았습니다",
        error: "INVALID_USER_ID",
        receivedUserId: null,
        receivedData: data,
        debug: {
          timestamp: new Date().toISOString(),
          dataStructure: {
            hasData: !!(data && data.data),
            hasDirectUserId: !!(data && data.userId),
            hasNestedUserId: !!(data && data.data && data.data.userId),
          },
        },
      };
    }

    // 입력 검증
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      functions.logger.error("❌ 유효하지 않은 사용자 ID:", {
        received: userId,
        type: typeof userId,
        dataKeys: Object.keys(data || {}),
        fullData: data,
      });
      return {
        isDefault: true,
        userRatingCount: 0,
        validRatingCount: 0,
        message: "유효하지 않은 사용자 ID",
        error: "INVALID_USER_ID",
        receivedUserId: userId,
        receivedData: data,
        debug: {
          timestamp: new Date().toISOString(),
        },
      };
    }

    // userId 정리 (공백 제거)
    userId = userId.trim();
    functions.logger.info(`👤 사용자 ID 확인됨: ${userId}`);

    // 🔍 사용자 별점 데이터 조회 (모든 가능한 경로 확인)
    const possiblePaths = [
      `users/${userId}/ratings`,
      `ratings/${userId}`,
      `userRatings/${userId}`,
      `user_ratings/${userId}`,
    ];

    let ratingsData = [];
    let successPath = null;
    let pathResults = {};

    // 각 경로 순차 확인
    for (const path of possiblePaths) {
      try {
        functions.logger.info(`🔍 경로 확인 중: ${path}`);

        const ratingsRef = db.collection(path);
        const snapshot = await ratingsRef.get();

        pathResults[path] = {
          exists: !snapshot.empty,
          size: snapshot.size,
          error: null,
        };

        functions.logger.info(
          `📊 ${path}: ${
            snapshot.empty ? "비어있음" : `${snapshot.size}개 문서`
          }`
        );

        if (!snapshot.empty) {
          functions.logger.info(
            `✅ 데이터 발견: ${path} (${snapshot.size}개 문서)`
          );

          ratingsData = snapshot.docs.map((doc) => {
            const docData = doc.data();
            return {
              id: doc.id,
              videoId: docData.videoId || doc.id,
              rating: docData.rating || docData.value || 0,
              timestamp: docData.timestamp || docData.createdAt || null,
              deleted: docData.deleted || false,
              ...docData,
            };
          });

          successPath = path;
          functions.logger.info(`📋 샘플 데이터:`, ratingsData.slice(0, 2));
          break;
        }
      } catch (error) {
        functions.logger.error(`❌ 경로 ${path} 접근 오류:`, error.message);
        pathResults[path] = {
          exists: false,
          size: 0,
          error: error.message,
        };
      }
    }

    // 🔍 특정 문서 직접 확인 (컬렉션에서 못 찾은 경우)
    if (ratingsData.length === 0) {
      functions.logger.info("🔄 특정 문서 직접 확인 시도...");

      // 알려진 videoId로 테스트
      const testVideoIds = ["oZpYEEcvu5I"];

      for (const testVideoId of testVideoIds) {
        const directPaths = [
          `users/${userId}/ratings/${testVideoId}`,
          `ratings/${userId}/${testVideoId}`,
          `userRatings/${userId}/${testVideoId}`,
        ];

        for (const docPath of directPaths) {
          try {
            functions.logger.info(`🔍 직접 문서 확인: ${docPath}`);
            const docRef = db.doc(docPath);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
              functions.logger.info(`✅ 직접 문서 발견: ${docPath}`);
              functions.logger.info(`📋 문서 데이터:`, docSnap.data());

              // 이 경로의 전체 컬렉션 다시 확인
              const collectionPath = docPath.substring(
                0,
                docPath.lastIndexOf("/")
              );
              functions.logger.info(`🔄 전체 컬렉션 재확인: ${collectionPath}`);

              const collectionRef = db.collection(collectionPath);
              const collectionSnap = await collectionRef.get();

              if (!collectionSnap.empty) {
                ratingsData = collectionSnap.docs.map((doc) => ({
                  id: doc.id,
                  videoId: doc.data().videoId || doc.id,
                  rating: doc.data().rating || doc.data().value || 0,
                  timestamp:
                    doc.data().timestamp || doc.data().createdAt || null,
                  deleted: doc.data().deleted || false,
                  ...doc.data(),
                }));

                successPath = collectionPath;
                functions.logger.info(
                  `✅ 전체 컬렉션에서 ${ratingsData.length}개 문서 발견`
                );
                break;
              }
            }
          } catch (error) {
            functions.logger.info(
              `⚠️ 직접 문서 확인 실패 ${docPath}:`,
              error.message
            );
          }
        }

        if (ratingsData.length > 0) break;
      }
    }

    // 📊 결과 분석
    const userRatingCount = ratingsData.length;
    const validRatings = ratingsData
      .filter((r) => r.rating > 0 && !r.deleted)
      .map((r) => ({
        videoId: r.videoId || r.id,
        rating: r.rating,
        artist: r.artist || null, // ⬅️ artist 필드 추출 (없으면 null)
      }));
    const validRatingCount = validRatings.length;

    functions.logger.info(`📊 분석 결과:`);
    functions.logger.info(`   총 별점 문서: ${userRatingCount}`);
    functions.logger.info(`   유효한 별점: ${validRatingCount}`);
    functions.logger.info(`   성공 경로: ${successPath || "없음"}`);

    // 실행 시간 계산
    const executionTime = Date.now() - startTime;

    // 🎯 응답 생성
    if (validRatingCount === 0) {
      functions.logger.info("📭 유효한 별점 없음 - 기본 추천 반환");

      return {
        isDefault: true,
        userRatingCount: userRatingCount,
        validRatingCount: validRatingCount,
        message:
          userRatingCount > 0
            ? `${userRatingCount}개의 별점이 있지만 모두 0점이거나 삭제됨`
            : "별점 데이터를 찾을 수 없어 기본 추천을 제공합니다",
        debug: {
          userId: userId,
          successPath: successPath,
          pathResults: pathResults,
          executionTimeMs: executionTime,
          timestamp: new Date().toISOString(),
          ratingSample: ratingsData.slice(0, 3),
        },
      };
    }

    functions.logger.info(
      `🎯 개인화 추천 생성: ${validRatingCount}개 별점 기반`
    );

    // 🔄 개인화 추천 로직 실행
    const recommendations = await generatePersonalizedLogic(
      userId,
      validRatings
    );

    return {
      isDefault: false,
      userRatingCount: userRatingCount,
      validRatingCount: validRatingCount,
      message: `${validRatingCount}개의 별점을 바탕으로 개인화 추천을 제공합니다`,
      recommendations: recommendations,
      debug: {
        userId: userId,
        successPath: successPath,
        pathResults: pathResults,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
        highRatedSongs: validRatings.filter((r) => r.rating >= 4).length,
        lowRatedSongs: validRatings.filter((r) => r.rating <= 2).length,
      },
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    functions.logger.error("💥 함수 실행 오류:", error);
    functions.logger.error("💥 오류 스택:", error.stack);

    return {
      isDefault: true,
      userRatingCount: 0,
      validRatingCount: 0,
      message: "서버 오류로 기본 추천을 제공합니다",
      error: error.message,
      debug: {
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorStack: error.stack,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
});

/**
 * 🎵 개인화 추천 로직 (신규 구현)
 */
async function generatePersonalizedLogic(userId, validRatings) {
  const db = getDb();
  functions.logger.info(
    "🎵 개인화 추천 알고리즘 실행 (하이브리드 3:7 + 3단계 로직)"
  );

  let globalStats = null;
  try {
    const globalStatsDoc = await db
      .collection("system")
      .doc("globalStats")
      .get();
    if (!globalStatsDoc.exists || !globalStatsDoc.data().popularSongs) {
      functions.logger.error(
        "❌ 치명적 오류: 글로벌 통계(system/globalStats)를 찾을 수 없거나 popularSongs가 없습니다."
      );
      return { isDefault: true, message: "글로벌 통계 부재" };
    }
    globalStats = globalStatsDoc.data();
  } catch (error) {
    functions.logger.warn("⚠️ 글로벌 통계 로드 실패:", error.message);
    return { isDefault: true, message: "글로벌 통계 로드 실패" };
  }

  const userSongRatings = {};
  const artistRatings = {};
  let totalUserRating = 0;

  validRatings.forEach((rating) => {
    userSongRatings[rating.videoId] = rating.rating;
    totalUserRating += rating.rating;
    if (rating.artist) {
      if (!artistRatings[rating.artist]) {
        artistRatings[rating.artist] = { total: 0, count: 0 };
      }
      artistRatings[rating.artist].total += rating.rating;
      artistRatings[rating.artist].count += 1;
    }
  });

  const personalAverageRating =
    validRatings.length > 0 ? totalUserRating / validRatings.length : 3.0;
  const personalArtistAvg = {};
  for (const artist in artistRatings) {
    personalArtistAvg[artist] =
      artistRatings[artist].total / artistRatings[artist].count;
  }
  functions.logger.info(
    `🎵 개인 점수 분석 완료 (1순위: ${
      Object.keys(userSongRatings).length
    }곡, 2순위: ${
      Object.keys(personalArtistAvg).length
    }명, 3순위: ${personalAverageRating.toFixed(2)}점)`
  );

  const recommendations = [];
  const isV3LogicReady =
    globalStats.popularSongs.length > 0 && globalStats.popularSongs[0].artist;

  if (isV3LogicReady) {
    functions.logger.info("✅ v3 로직 실행 (3:7 Artist-based)");
    const W_global = 0.3;
    const W_personal = 0.7;

    globalStats.popularSongs.forEach((song) => {
      const artist = song.artist;
      const globalScore = song.bayesianAverage;
      let personalScore = personalAverageRating; // 3순위
      if (personalArtistAvg[artist]) {
        personalScore = personalArtistAvg[artist]; // 2순위
      }
      if (userSongRatings[song.videoId]) {
        personalScore = userSongRatings[song.videoId]; // 1순위
      }
      const finalScore = W_global * globalScore + W_personal * personalScore;
      recommendations.push({ videoId: song.videoId, score: finalScore });
    });
  } else {
    functions.logger.warn(
      "⚠️ globalStats에 artist 누락. v2 로직(6:4)으로 Fallback합니다."
    );
    const W_global = 0.6;
    const W_personal = 0.4;
    globalStats.popularSongs.forEach((song) => {
      const globalScore = song.bayesianAverage;
      const personalScore = personalAverageRating;
      const finalScore = W_global * globalScore + W_personal * personalScore;
      recommendations.push({ videoId: song.videoId, score: finalScore });
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  const personalizedOrder = recommendations.map((r) => r.videoId);

  const userRecommendations = {
    userId,
    songs: personalizedOrder,
    generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
    userRatingCount: validRatings.length,
    personalizedOrder: true,
    algorithm: isV3LogicReady ? "hybrid_v3_p70_artist" : "hybrid_v2_fallback",
    scores: recommendations.slice(0, 30),
  };

  await db
    .collection("users")
    .doc(userId)
    .collection("recommendations")
    .doc("songs")
    .set(userRecommendations);

  functions.logger.info(
    `✅ 개인화 추천 저장 완료: ${personalizedOrder.length}곡`
  );

  return userRecommendations;
}

exports.healthCheck = onRequest({ invoker: "public" }, (request, response) => {
  try {
    functions.logger.info("헬스체크 요청");

    const status = {
      status: "healthy",
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      message: "추천 시스템 Functions 정상 동작 중",
      versions: {
        lodash: _.VERSION,
        moment: moment.version,
        node: process.version,
      },
      memoryUsage: process.memoryUsage(),
    };

    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "GET, POST");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.json(status);
  } catch (error) {
    functions.logger.error("💥 healthCheck 오류:", error);
    response.status(500).send("Health check failed");
  }
});

exports.testFirestore = onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  const db = getDb();
  try {
    functions.logger.info("Firestore 연결 테스트 시작");

    const usersSnapshot = await db.collection("users").limit(5).get();
    const userCount = usersSnapshot.size;

    let ratingsCount = 0;
    let firstUserId = null;

    if (!usersSnapshot.empty) {
      firstUserId = usersSnapshot.docs[0].id;
      const ratingsSnapshot = await db
        .collection("users")
        .doc(firstUserId)
        .collection("ratings")
        .limit(10)
        .get();
      ratingsCount = ratingsSnapshot.size;
    }

    const result = {
      success: true,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      data: {
        userCount,
        sampleRatingsCount: ratingsCount,
        sampleUserId: firstUserId,
        message: "Firestore 연결 성공",
      },
    };

    functions.logger.info("Firestore 테스트 완료", result);
    return result;
  } catch (error) {
    functions.logger.error("Firestore 테스트 실패", error);
    throw new functions.https.HttpsError(
      "internal",
      `Firestore 연결 실패: ${error.message}`
    );
  }
});

exports.calculateGlobalStats = onRequest(
  {
    timeoutSeconds: 540,
    memory: "1GiB",
    region: "us-central1",
    invoker: "public",
  },
  async (request, response) => {
    try {
      const db = getDb();
      functions.logger.info(
        "🔄 글로벌 통계 계산 시작 (onCall v2 / artist 포함)"
      );
      const startTime = Date.now();

      const data = request.body.data;
      const knownUserId = data && data.debugUserId ? data.debugUserId : null;
      if (knownUserId) {
        functions.logger.info(
          `🧪 디버그 모드: 특정 사용자 ${knownUserId}로 테스트`
        );
      }

      functions.logger.info(
        '👥 collectionGroup("ratings")를 사용하여 모든 사용자 ID 수집 중...'
      );
      let userIds = [];
      try {
        const ratingsQuery = await db.collectionGroup("ratings").get();
        const foundUserIds = new Set();

        ratingsQuery.forEach((doc) => {
          const pathParts = doc.ref.path.split("/");
          if (pathParts.length >= 2 && pathParts[0] === "users") {
            foundUserIds.add(pathParts[1]);
          }
        });
        userIds = Array.from(foundUserIds);
      } catch (groupError) {
        functions.logger.error("❌ 컬렉션 그룹 쿼리 실패:", groupError);
        response.status(500).send({
          success: false,
          message: "컬렉션 그룹 쿼리 실패: " + groupError.message,
        });
        return;
      }

      const actualTotalUsers = userIds.length;
      if (actualTotalUsers === 0) {
        functions.logger.error("❌ 처리할 사용자가 없습니다!");
        response.status(400).send({
          success: false,
          message: "처리할 사용자 데이터 없음",
        });
        return; // ⬅️ [수정] 함수 종료
      }

      let totalRatings = 0;
      const songStats = {};
      let processedUsers = 0;
      let usersWithRatings = 0;

      for (const userId of userIds) {
        try {
          processedUsers++;
          const ratingsSnapshot = await db
            .collection("users")
            .doc(userId)
            .collection("ratings")
            .get();
          if (ratingsSnapshot.size === 0) continue;
          let userValidRatings = 0;
          ratingsSnapshot.forEach((ratingDoc) => {
            const rating = ratingDoc.data();
            const isValidRating =
              rating.rating &&
              typeof rating.rating === "number" &&
              rating.rating > 0 &&
              rating.videoId &&
              rating.artist && // ⬅️ artist 확인
              !rating.deleted;

            if (isValidRating) {
              totalRatings++;
              userValidRatings++;
              if (!songStats[rating.videoId]) {
                songStats[rating.videoId] = {
                  totalScore: 0,
                  ratingCount: 0,
                  videoId: rating.videoId,
                  artist: rating.artist, // ⬅️ artist 저장
                };
              }
              songStats[rating.videoId].totalScore += rating.rating;
              songStats[rating.videoId].ratingCount += 1;
            }
          });
          if (userValidRatings > 0) usersWithRatings++;
        } catch (userError) {
          functions.logger.error(`❌ 사용자 ${userId} 처리 실패:`, userError);
        }
      }

      const finalStats = {
        actualTotalUsers: actualTotalUsers,
        processedUsers: processedUsers,
        usersWithRatings: usersWithRatings,
        totalRatings: totalRatings,
        totalSongs: Object.keys(songStats).length,
        userIds: userIds,
      };

      functions.logger.info("📈 최종 통계:", finalStats); // 🔧 7단계: 여전히 0이면 상세 디버깅

      if (totalRatings === 0) {
        functions.logger.error("🚨 여전히 별점 0개! 상세 분석 필요"); // 첫 번째 사용자의 첫 번째 별점 문서 상세 분석

        if (userIds.length > 0) {
          try {
            const firstUserId = userIds[0];
            const firstUserRatings = await db
              .collection("users")
              .doc(firstUserId)
              .collection("ratings")
              .limit(1)
              .get();

            if (!firstUserRatings.empty) {
              const firstRating = firstUserRatings.docs[0].data();
              functions.logger.error("🔍 첫 번째 별점 문서 상세:", {
                fullData: firstRating,
                ratingField: firstRating.rating,
                ratingType: typeof firstRating.rating,
                ratingValue: JSON.stringify(firstRating.rating),
                videoIdField: firstRating.videoId,
                deletedField: firstRating.deleted,
                allFields: Object.keys(firstRating),
              });
            }
          } catch (debugError) {
            functions.logger.error("❌ 디버깅 분석 실패:", debugError);
          }
        }

        response.status(500).send({
          success: false,
          message: "별점 데이터 처리 실패",
        });
        return; // ⬅️ [수정] 함수 종료
      }

      functions.logger.info("🧮 베이지안 평균 계산...");

      const PRIOR_MEAN = 3.0;
      const PRIOR_COUNT = 5;

      const popularSongs = Object.values(songStats)
        .map((song) => {
          const avg = song.totalScore / song.ratingCount;
          const bayesianAvg =
            (song.totalScore + PRIOR_MEAN * PRIOR_COUNT) /
            (song.ratingCount + PRIOR_COUNT);

          return {
            videoId: song.videoId,
            artist: song.artist,
            averageRating: avg,
            bayesianAverage: bayesianAvg,
            ratingCount: song.ratingCount,
          };
        })
        .sort((a, b) => b.bayesianAverage - a.bayesianAverage)
        .slice(0, 20);

      functions.logger.info(
        `🏆 인기곡 TOP ${popularSongs.length}:`,
        popularSongs.map(
          (song) =>
            `${song.videoId}: ${song.bayesianAverage.toFixed(2)} (${
              song.ratingCount
            }회)`
        )
      ); // 🔧 9단계: 최종 결과

      const globalStats = {
        totalUsers: actualTotalUsers,
        totalRatings,
        totalSongs: Object.keys(songStats).length,
        popularSongs,
        lastUpdated: moment().format("YYYY-MM-DD HH:mm:ss"),
        processingTime: Date.now() - startTime,
        debug: finalStats,
      };

      await db.collection("system").doc("globalStats").set(globalStats);

      functions.logger.info("✅ 글로벌 통계 계산 완료!", {
        processingTime: globalStats.processingTime,
        totalUsers: actualTotalUsers,
        totalRatings,
        totalSongs: globalStats.totalSongs,
        topSongs: popularSongs
          .slice(0, 3)
          .map((s) => `${s.videoId}(${s.ratingCount})`),
      });

      response.json({
        success: true,
        message: "글로벌 통계 계산 완료",
        stats: globalStats,
      });
    } catch (error) {
      functions.logger.error("❌ 글로벌 통계 계산 실패:", error);
      response.status(500).send({
        success: false,
        message: `통계 계산 실패: ${error.message}`,
      });
    }
  }
);

exports.generateUserRecommendations = onCall(async (request) => {
  const db = getDb();
  const data = request.data;
  const auth = request.auth;
  let userId;
  if (data && data.data && data.data.userId) {
    userId = data.data.userId;
  } else if (data && data.userId) {
    userId = data.userId;
  } else {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userId가 필요합니다"
    );
  }

  try {
    functions.logger.info(`🎯 사용자 추천 생성 시작: ${userId}`);
    const startTime = Date.now();

    // 글로벌 통계 가져오기
    const globalStatsDoc = await db
      .collection("system")
      .doc("globalStats")
      .get();
    let globalStats = null;
    if (!globalStatsDoc.exists) {
      // 글로벌 통계가 없으면 먼저 계산
      functions.logger.info("글로벌 통계 없음, 먼저 계산 실행");
      functions.logger.warn(
        "글로벌 통계 없음. calculateGlobalStats를 URL로 먼저 실행해야 합니다."
      );
    } else {
      globalStats = globalStatsDoc.data();
    }

    const userRatingsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("ratings")
      .get();

    const userRatings = {};
    userRatingsSnapshot.forEach((doc) => {
      const rating = doc.data();
      if (rating.rating && rating.rating > 0 && !rating.deleted) {
        userRatings[rating.videoId] = rating.rating;
      }
    });

    functions.logger.info(
      `사용자 별점 로드: ${Object.keys(userRatings).length}개`
    );

    const recommendations = [];

    if (
      globalStats &&
      globalStats.popularSongs &&
      globalStats.popularSongs.length > 0
    ) {
      functions.logger.info(
        `글로벌 인기곡 기반 추천: ${globalStats.popularSongs.length}곡`
      );
      globalStats.popularSongs.forEach((song) => {
        let totalScore = 4.0; // 기본 점수

        // 글로벌 인기도 점수 (0~2.5점)
        const popularityScore = Math.min(
          2.5,
          (song.bayesianAverage - 1) * 0.625
        );
        totalScore += popularityScore;

        // 개인 별점 반영 (이미 평가한 곡)
        if (userRatings[song.videoId]) {
          totalScore = userRatings[song.videoId] * 2; // 개인 평점 × 2
        }

        recommendations.push({
          videoId: song.videoId,
          score: Math.min(10, totalScore),
          categories: {
            userArtistScore: 1.0,
            globalPopularityScore: popularityScore,
            similarUsersScore: 1.0,
            songCorrelationScore: 1.0,
          },
        });
      });
    } else {
      functions.logger.info("글로벌 인기곡 없음, 기본 추천 사용");
      const defaultSongs = [
        "oZpYEEcvu5I",
        "mX9IJ7Urn28",
        "goCvO7uJhu8",
        "4Bqaflz8XZU",
        "F8p-5hGLe7s",
        "QjZKNhEMeM4",
        "K3XcXH8_ZlY",
      ];
      defaultSongs.forEach((videoId, index) => {
        let score = 5.0 - index * 0.1; // 순서대로 점수 감소
        // 개인 별점이 있으면 우선 반영
        if (userRatings[videoId]) {
          score = userRatings[videoId] * 2;
        }
        recommendations.push({
          videoId,
          score,
          categories: {
            userArtistScore: 1.0,
            globalPopularityScore: 1.0,
            similarUsersScore: 1.0,
            songCorrelationScore: 1.0,
          },
        });
      });
    }

    // 점수 순으로 정렬
    recommendations.sort((a, b) => b.score - a.score);

    // 실제 추천 데이터 생성
    const userRecommendations = {
      userId,
      songs: recommendations.map((r) => r.videoId), // 실제 추천곡 배열
      scores: recommendations.reduce((acc, r) => {
        acc[r.videoId] = r.score;
        return acc;
      }, {}),
      categories: recommendations.reduce((acc, r) => {
        acc[r.videoId] = r.categories;
        return acc;
      }, {}),
      generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
      processingTime: Date.now() - startTime,
      userRatingCount: Object.keys(userRatings).length,
    };

    // Firestore에 개인 추천 저장
    await db
      .collection("users")
      .doc(userId)
      .collection("recommendations")
      .doc("songs")
      .set(userRecommendations);

    functions.logger.info(`✅ 사용자 추천 생성 완료: ${userId}`, {
      processingTime: userRecommendations.processingTime,
      recommendationCount: recommendations.length,
      userRatingCount: userRecommendations.userRatingCount,
      hasGlobalStats: !!globalStats,
    });

    return {
      success: true,
      message: "개인 추천 생성 완료",
      data: userRecommendations,
    };
  } catch (error) {
    functions.logger.error(`❌ 사용자 추천 생성 실패: ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      `추천 생성 실패: ${error.message}`
    );
  }
});

exports.dailyRecommendationBatch = onRequest(
  {
    timeoutSeconds: 540,
    memory: "2GiB",
    region: "us-central1",
  },
  async (request, response) => {
    const db = getDb();
    try {
      functions.logger.info("🌅 일일 추천 배치 시작", {
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      });

      const usersSnapshot = await db.collection("users").get();
      const totalUsers = usersSnapshot.size;

      let totalRatings = 0;
      const songStats = {};

      for (const userDoc of usersSnapshot.docs) {
        const ratingsSnapshot = await db
          .collection("users")
          .doc(userDoc.id)
          .collection("ratings")
          .where("rating", ">", 0)
          .get();

        ratingsSnapshot.forEach((ratingDoc) => {
          const rating = ratingDoc.data();
          totalRatings++;

          if (!songStats[rating.videoId]) {
            songStats[rating.videoId] = {
              totalScore: 0,
              ratingCount: 0,
              videoId: rating.videoId,
            };
          }
          songStats[rating.videoId].totalScore += rating.rating;
          songStats[rating.videoId].ratingCount += 1;
        });
      }

      const globalStats = {
        totalUsers,
        totalRatings,
        totalSongs: Object.keys(songStats).length,
        lastUpdated: moment().format("YYYY-MM-DD HH:mm:ss"),
      };

      await db.collection("system").doc("globalStats").set(globalStats);

      const activeUsers = [];
      const testUsers = usersSnapshot.docs.slice(0, 5);

      for (const userDoc of testUsers) {
        try {
          const userRecommendations = {
            userId: userDoc.id,
            songs: [],
            generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
            batchGenerated: true,
          };

          await db
            .collection("users")
            .doc(userDoc.id)
            .collection("recommendations")
            .doc("songs")
            .set(userRecommendations);

          activeUsers.push(userDoc.id);
        } catch (error) {
          functions.logger.warn(`사용자 추천 생성 실패: ${userDoc.id}`, error);
        }
      }

      const result = {
        success: true,
        message: "일일 배치 완료",
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
        processedUsers: activeUsers.length,
        totalUsers,
        totalRatings,
      };

      functions.logger.info("✅ 일일 추천 배치 완료", result);
      response.json(result);
    } catch (error) {
      functions.logger.error("❌ 일일 추천 배치 실패", error);
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"), // ⬅️ 이제 안전함
      });
    }
  }
);

exports.getUserRecommendations = onCall(async (request) => {
  const db = getDb();
  const data = request.data;
  const auth = request.auth;
  try {
    functions.logger.info("📥 getUserRecommendations 호출", {
      data: data,
      hasUserId: !!(data && data.userId),
      authUid: auth ? auth.uid : null,
    });

    // 🎯 중첩된 데이터 구조 처리
    let userId;
    if (data && data.data && data.data.userId) {
      userId = data.data.userId;
      functions.logger.info("✅ 중첩된 구조에서 userId 추출", { userId });
    } else if (data && data.userId) {
      userId = data.userId;
      functions.logger.info("✅ 단순 구조에서 userId 추출", { userId });
    } else {
      functions.logger.error("❌ userId 파라미터 없음", {
        data: data,
        dataType: typeof data,
        hasData: !!(data && data.data),
        hasUserId: !!(data && data.userId),
        hasNestedUserId: !!(data && data.data && data.data.userId),
      });
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId가 필요합니다"
      );
    }

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      functions.logger.error("❌ 유효하지 않은 userId", { userId });
      throw new functions.https.HttpsError(
        "invalid-argument",
        "유효한 userId가 필요합니다"
      );
    }
    functions.logger.info("✅ userId 추출 완료", { userId: userId });

    const recommendationDoc = await db
      .collection("users")
      .doc(userId)
      .collection("recommendations")
      .doc("songs")
      .get();

    if (!recommendationDoc.exists) {
      functions.logger.info("📭 추천 데이터 없음, 기본 추천 제공", {
        userId,
      });

      const userId = data && data.userId ? data.userId : "unknown";
      const defaultRecommendations = await generateDefaultRecommendations(
        userId
      );

      return {
        success: true,
        data: {
          userId: userId,
          songs: defaultRecommendations,
          generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
          userRatingCount: 0,
          isDefault: true,
        },
        message: "기본 추천 제공",
      };
    }

    const recommendationData = recommendationDoc.data();
    functions.logger.info("✅ 추천 데이터 조회 성공", {
      userId: userId,
      songsCount: recommendationData.songs
        ? recommendationData.songs.length
        : 0,
      generatedAt: recommendationData.generatedAt,
    });

    return {
      success: true,
      data: recommendationData,
      message: "개인 추천 조회 성공",
    };
  } catch (error) {
    functions.logger.error("❌ getUserRecommendations 실패", {
      error: error.message,
      stack: error.stack,
      data: data,
    });

    const userId = data && data.userId ? data.userId : "unknown";
    const defaultRecommendations = await generateDefaultRecommendations(userId);

    return {
      success: true,
      data: {
        userId: userId,
        songs: defaultRecommendations,
        generatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
        userRatingCount: 0,
        isError: true,
        errorMessage: error.message,
      },
      message: "에러 발생, 기본 추천 제공",
    };
  }
});

async function generateDefaultRecommendations(userId) {
  const db = getDb();
  try {
    functions.logger.info("🎯 기본 추천 생성", { userId });

    const globalStatsDoc = await db
      .collection("system")
      .doc("globalStats")
      .get();

    if (globalStatsDoc.exists) {
      const globalStats = globalStatsDoc.data();
      if (globalStats.popularSongs && globalStats.popularSongs.length > 0) {
        const topSongs = globalStats.popularSongs
          .slice(0, 10)
          .map((song) => song.videoId);

        functions.logger.info("✅ 글로벌 인기곡 반환", {
          count: topSongs.length,
          songs: topSongs,
        });
        return topSongs;
      }
    }

    const defaultSongs = [
      "oZpYEEcvu5I",
      "mX9IJ7Urn28",
      "goCvO7uJhu8",
      "4Bqaflz8XZU",
      "F8p-5hGLe7s",
      "QjZKNhEMeM4",
      "K3XcXH8_ZlY",
    ];

    functions.logger.info("✅ 기본 추천곡 반환", {
      count: defaultSongs.length,
      songs: defaultSongs,
    });
    return defaultSongs;
  } catch (error) {
    functions.logger.error("❌ 기본 추천 생성 실패", error);
    return ["oZpYEEcvu5I", "mX9IJ7Urn28", "goCvO7uJhu8"];
  }
}

exports.testEcho = onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  try {
    functions.logger.info("testEcho 호출됨 - 상세 분석", {
      data: data,
      dataType: typeof data,
      hasData: !!(data && data.data),
      hasUserId: !!(data && data.userId),
      hasNestedUserId: !!(data && data.data && data.data.userId),
      nestedUserId: data && data.data ? data.data.userId : null,
      directUserId: data ? data.userId : null,
      auth: auth && auth.uid ? auth.uid : null,
    });

    // 중첩된 구조 처리
    let userId = null;
    if (data && data.data && data.data.userId) {
      userId = data.data.userId;
    } else if (data && data.userId) {
      userId = data.userId;
    }

    return {
      success: true,
      echo: data,
      extractedUserId: userId,
      dataStructureAnalysis: {
        hasData: !!(data && data.data),
        hasDirectUserId: !!(data && data.userId),
        hasNestedUserId: !!(data && data.data && data.data.userId),
      },
      message: "파라미터 수신 테스트 완료",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    functions.logger.error("💥 testEcho 오류:", error);
    return { success: false, error: error.message };
  }
});

exports.getUserRatings = onCall(async (request) => {
  const db = getDb();
  const data = request.data;
  let userId;
  if (data && data.data && data.data.userId) {
    userId = data.data.userId;
  } else if (data && data.userId) {
    userId = data.userId;
  } else {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userId가 필요합니다"
    );
  }

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "유효한 userId가 필요합니다"
    );
  }

  try {
    const ratingsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("ratings")
      .get();

    const ratings = {};
    ratingsSnapshot.forEach((doc) => {
      const rating = doc.data();
      ratings[rating.videoId] = rating;
    });

    return {
      success: true,
      userId,
      ratingsCount: ratingsSnapshot.size,
      ratings,
    };
  } catch (error) {
    functions.logger.error(`사용자 별점 조회 실패: ${userId}`, error);
    throw new functions.https.HttpsError(
      "internal",
      `별점 조회 실패: ${error.message}`
    );
  }
});
