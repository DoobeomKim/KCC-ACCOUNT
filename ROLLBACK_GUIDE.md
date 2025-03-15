# 롤백 시 필요한 전체 과정
1. git reset --hard 30b1107
2. rm -rf node_modules .next
3. npm install
4. npm run build

Git 롤백 시 주의해야 할 점들을 설명드리겠습니다:
완벽하게 돌아가는 것들:
버전 관리되는 파일들 (git add로 추가된 파일들)
소스코드
설정 파일들 (next.config.js, package.json 등)

주의가 필요한 것들:
node_modules 폴더 (git에서 제외됨)
.env 파일들 (보안상 git에서 제외됨)
빌드 파일들 (.next 폴더)
임시 파일들 (temp 폴더, 로그 파일 등)
