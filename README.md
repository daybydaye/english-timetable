# 화상영어 시간표

- 학생용: `index.html`. 선생님별 주간 시간표를 볼 수 있고, '시간 변경 신청'을 누르면 카카오톡 1:1 오픈채팅이 열립니다.
- 선생님용: `teacher.html`. 선생님 키를 넣고 칸을 칠한 뒤 저장하면 `data.json`에 커밋됩니다. 1~2분 안에 학생 화면에 반영됩니다.

## 선생님 키 만들기 (원장님)
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access: **Only select repositories** → 이 저장소만 선택
3. Permissions → Repository permissions → **Contents: Read and write**
4. 만든 토큰(github_pat_…)을 선생님들께 '선생님 키'로 전달

키가 유출되면 GitHub에서 그 토큰을 삭제하고 새로 만들어 다시 나눠 주세요.
이 사이트는 공개되어 있으니 학생 이름은 적지 마세요.
