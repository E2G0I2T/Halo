module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    "quotes": "off",  // 따옴표 규칙 끄기
    "max-len": "off",  // 줄 길이 제한 끄기
    "no-unused-vars": "off",  // 미사용 변수 경고 끄기
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "comma-dangle": "off",  // trailing comma 끄기
    "eol-last": "off",  // 파일 끝 새줄 끄기
  },
};