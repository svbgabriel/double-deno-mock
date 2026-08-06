const API_URL = '/__admin/mocks'

const mockList = document.getElementById('mock-list')
const mockForm = document.getElementById('mock-form')
const editorSection = document.getElementById('editor-section')
const mockListSection = document.getElementById('mock-list-section')
const newMockBtn = document.getElementById('new-mock-btn')
const cancelBtn = document.getElementById('cancel-btn')
const mockTypeSelect = document.getElementById('mock-type')
const conditionsList = document.getElementById('conditions-list')
const addConditionBtn = document.getElementById('add-condition-btn')

// State
let mocks = []

function addConditionRow(condition = null) {
  const row = document.createElement('div')
  row.className = 'condition-row'

  const source = condition?.source || 'header'
  const key = condition?.key || ''
  const op = condition?.op || 'equals'
  const value = condition?.value || ''
  const status = condition?.response?.status || 200
  const contentType = condition?.response?.contentType || ''
  const body = condition?.response?.body || ''

  row.innerHTML = `
    <div class="condition-header">
      <div class="field-group">
        <select class="cond-source">
          <option value="header" ${source === 'header' ? 'selected' : ''}>Header</option>
          <option value="query" ${source === 'query' ? 'selected' : ''}>Query</option>
          <option value="body" ${source === 'body' ? 'selected' : ''}>Body</option>
        </select>
        <input type="text" class="cond-key" placeholder="Key" value="${key}">
        <select class="cond-op">
          <option value="equals" ${op === 'equals' ? 'selected' : ''}>Equals</option>
          <option value="notEquals" ${op === 'notEquals' ? 'selected' : ''}>Not Equals</option>
          <option value="exists" ${op === 'exists' ? 'selected' : ''}>Exists</option>
          <option value="notExists" ${op === 'notExists' ? 'selected' : ''}>Not Exists</option>
        </select>
        <input type="text" class="cond-value" placeholder="Value" value="${value}" style="display: ${op === 'exists' || op === 'notExists' ? 'none' : 'inline-block'}">
      </div>
      <button type="button" class="delete-btn remove-cond-btn">Remove</button>
    </div>
    <div class="condition-response">
      <div class="field-group">
        <label>Response Status</label>
        <input type="number" class="cond-status" placeholder="Status" value="${status}">
        <label>Content-Type</label>
        <input type="text" class="cond-content-type" list="content-types" placeholder="Content-Type" value="${contentType}">
      </div>
      <label>Response Body (JSON string)</label>
      <textarea class="cond-body" placeholder="Response Body">${body}</textarea>
    </div>
  `

  row.querySelector('.cond-op').addEventListener('change', (e) => {
    const valInput = row.querySelector('.cond-value')
    if (e.target.value === 'exists' || e.target.value === 'notExists') {
      valInput.style.display = 'none'
    }
    else {
      valInput.style.display = 'inline-block'
    }
  })

  row.querySelector('.remove-cond-btn').addEventListener('click', () => {
    row.remove()
  })

  conditionsList.appendChild(row)
}

function readConditionsFromForm() {
  const rows = conditionsList.querySelectorAll('.condition-row')
  const conditions = []
  rows.forEach((row) => {
    const key = row.querySelector('.cond-key').value.trim()
    if (!key) return

    const op = row.querySelector('.cond-op').value
    const condition = {
      source: row.querySelector('.cond-source').value,
      key: key,
      op: op,
      response: {
        status: parseInt(row.querySelector('.cond-status').value) || 200,
        contentType: row.querySelector('.cond-content-type').value || undefined,
        body: row.querySelector('.cond-body').value || undefined,
      },
    }

    if (op !== 'exists' && op !== 'notExists') {
      condition.value = row.querySelector('.cond-value').value
    }

    conditions.push(condition)
  })
  return conditions
}

async function fetchMocks() {
  try {
    const res = await fetch(API_URL)
    mocks = await res.json()
    renderMocks()
  }
  catch (err) {
    mockList.innerHTML = 'Error loading mocks: ' + err.message
  }
}

window.resetSeq = async function (id, type = 'sequence') {
  await fetch(`${API_URL}/${id}/reset`, { method: 'POST' })
  alert(`${type === 'rest' ? 'REST state' : 'Sequence'} reset`)
}

window.deleteMock = async function (id) {
  if (!confirm('Are you sure?')) return
  await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
  fetchMocks()
}

window.editMock = function (id) {
  const m = mocks.find((x) => x.id === id)
  if (!m) return

  document.getElementById('mock-id').value = m.id
  document.getElementById('mock-name').value = m.name
  document.getElementById('mock-method').value = m.method
  document.getElementById('mock-path').value = m.path
  document.getElementById('mock-priority').value = m.priority
  document.getElementById('mock-type').value = m.type

  // Config fields
  if (m.type === 'static') {
    document.getElementById('static-status').value = m.response?.status || 200
    document.getElementById('static-content-type').value = m.response?.contentType || 'text/plain'
    document.getElementById('static-body').value = m.response?.body || ''
  }
  else if (m.type === 'conditional') {
    conditionsList.innerHTML = ''
    if (m.conditions && Array.isArray(m.conditions)) {
      m.conditions.forEach((c) => addConditionRow(c))
    }
    document.getElementById('else-status').value = m.elseResponse?.status || 404
    document.getElementById('else-content-type').value = m.elseResponse?.contentType || 'text/plain'
  }
  else if (m.type === 'sequence') {
    document.getElementById('sequence-config').value = JSON.stringify(m.sequence || [], null, 2)
    document.getElementById('sequence-cycle').checked = m.sequenceMode !== 'stopAtEnd'
  }
  else if (m.type === 'script') {
    document.getElementById('script-code').value = m.script || ''
  }
  else if (m.type === 'rest') {
    document.getElementById('rest-id-field').value = m.restIdField || 'id'
    document.getElementById('rest-initial-state').value = JSON.stringify(m.restInitialState || [], null, 2)
  }

  showEditor(true)
  updateConfigFields()
}

function renderMocks() {
  if (mocks.length === 0) {
    mockList.innerHTML = '<p>No mocks found. Create one!</p>'
    return
  }
  mockList.innerHTML = mocks.map((m) => `
        <div class="mock-item">
            <div class="mock-info">
                <h3>${m.name}</h3>
                <p><strong>${m.method}</strong> ${m.path} (${m.type})</p>
            </div>
            <div class="actions">
                ${(m.type === 'sequence' || m.type === 'rest') ? `<button class="reset-btn" onclick="resetSeq('${m.id}', '${m.type}')">Reset</button>` : ''}
                <button onclick="editMock('${m.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteMock('${m.id}')">Delete</button>
            </div>
        </div>
    `).join('')
}

function showEditor(show) {
  editorSection.style.display = show ? 'block' : 'none'
  mockListSection.style.display = show ? 'none' : 'block'
  if (!show) {
    mockForm.reset()
    document.getElementById('mock-id').value = ''
    conditionsList.innerHTML = ''
  }
}

function updateConfigFields() {
  const type = mockTypeSelect.value
  document.querySelectorAll('.config-fields').forEach((el) => el.style.display = 'none')
  const target = document.getElementById(`config-${type}`)
  if (target) target.style.display = 'block'
}

mockTypeSelect.addEventListener('change', updateConfigFields)

newMockBtn.addEventListener('click', () => {
  showEditor(true)
  document.getElementById('static-content-type').value = 'text/plain'
  document.getElementById('else-content-type').value = 'text/plain'
  conditionsList.innerHTML = ''
  updateConfigFields()
})

cancelBtn.addEventListener('click', () => showEditor(false))

mockForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('mock-id').value
  const type = document.getElementById('mock-type').value

  const mock = {
    name: document.getElementById('mock-name').value,
    method: document.getElementById('mock-method').value,
    path: document.getElementById('mock-path').value,
    priority: parseInt(document.getElementById('mock-priority').value),
    type: type,
  }

  try {
    if (type === 'static') {
      mock.response = {
        status: parseInt(document.getElementById('static-status').value),
        contentType: document.getElementById('static-content-type').value || 'text/plain',
        body: document.getElementById('static-body').value,
      }
    }
    else if (type === 'conditional') {
      mock.conditions = readConditionsFromForm()
      mock.elseResponse = {
        status: parseInt(document.getElementById('else-status').value),
        contentType: document.getElementById('else-content-type').value || 'text/plain',
      }
    }
    else if (type === 'sequence') {
      mock.sequence = JSON.parse(document.getElementById('sequence-config').value || '[]')
      mock.sequenceMode = document.getElementById('sequence-cycle').checked ? 'cycle' : 'stopAtEnd'
    }
    else if (type === 'script') {
      mock.script = document.getElementById('script-code').value
    }
    else if (type === 'rest') {
      mock.restIdField = document.getElementById('rest-id-field').value || 'id'
      mock.restInitialState = JSON.parse(document.getElementById('rest-initial-state').value || '[]')
    }
  }
  catch (err) {
    alert('Invalid JSON in configuration: ' + err.message)
    return
  }

  const method = id ? 'PUT' : 'POST'
  const url = id ? `${API_URL}/${id}` : API_URL

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mock),
  })

  if (res.ok) {
    showEditor(false)
    fetchMocks()
  }
  else {
    const err = await res.json()
    alert(`Error: ${err.error}`)
  }
})

// Init
addConditionBtn.addEventListener('click', () => addConditionRow())
fetchMocks()
