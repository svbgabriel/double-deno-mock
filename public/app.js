const API_URL = '/__admin/mocks'

const mockList = document.getElementById('mock-list')
const mockForm = document.getElementById('mock-form')
const editorSection = document.getElementById('editor-section')
const mockListSection = document.getElementById('mock-list-section')
const newMockBtn = document.getElementById('new-mock-btn')
const cancelBtn = document.getElementById('cancel-btn')
const mockTypeSelect = document.getElementById('mock-type')

// State
let mocks = []

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

window.resetSeq = async function (id) {
  await fetch(`${API_URL}/${id}/reset`, { method: 'POST' })
  alert('Sequence reset')
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
    document.getElementById('conditional-config').value = JSON.stringify(m.conditions || [], null, 2)
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
                ${m.type === 'sequence' ? `<button class="reset-btn" onclick="resetSeq('${m.id}')">Reset</button>` : ''}
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
      mock.conditions = JSON.parse(document.getElementById('conditional-config').value || '[]')
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
fetchMocks()
