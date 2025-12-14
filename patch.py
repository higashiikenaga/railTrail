from pathlib import Path, re
path = Path('main.js')
text = path.read_text()
path = Path('main.js')
text = path.read_text()
pattern = r'      function applyKingLaw\(law, score\)[\s\S]*?      function showNewspaperHeadline'
new_func = '''      function applyKingLaw(law, score, executorId) {
        const actorId = typeof executorId === 'string' ? executorId : 'player';
        const actorName = getCandidateName(actorId);
        const actorName = getCandidateName(actorId);
