(() => {
  const control = document.querySelector('#showEvaluatorNames');
  if (!control) return;
  const room = new URLSearchParams(location.search).get('room') || 'default';
  const endpoint = '/api/evaluator-visibility?room=' + encodeURIComponent(room);
  let saved = false;
  let saving = false;
  let requestId = 0;
  const apply = value => {
    saved = value;
    control.checked = value;
    document.documentElement.classList.toggle('show-evaluator-names', value);
  };
  async function refresh() {
    if (saving) return;
    const id = ++requestId;
    try {
      const response = await fetch(endpoint, {cache: 'no-store'});
      if (!response.ok) throw new Error('Unable to load visibility');
      const data = await response.json();
      if (id !== requestId || saving) return;
      apply(data.showEvaluatorNames !== false);
      control.disabled = false;
      control.title = '';
    } catch {
      control.title = 'Unable to load setting. Refresh to retry.';
    }
  }
  control.addEventListener('change', async () => {
    const desired = control.checked;
    saving = true;
    requestId++;
    control.disabled = true;
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({showEvaluatorNames: desired})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Save failed');
      apply(data.showEvaluatorNames);
    } catch (error) {
      apply(saved);
      alert(error.message);
    } finally {
      saving = false;
      control.disabled = false;
      refresh();
    }
  });
  window.evaluatorVisibility = {refresh};
  window.addEventListener('focus', refresh);
  refresh();
})();
