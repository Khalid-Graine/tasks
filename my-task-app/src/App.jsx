import { useState } from 'react'

function App() {
  const [tasks, setTasks] = useState([])
  const [input, setInput] = useState('')

  const addTask = () => {
    if (input.trim()) {
      setTasks([...tasks, { text: input, done: false }])
      setInput('')
    }
  }

  const toggleTask = (index) => {
    const newTasks = [...tasks]
    newTasks[index].done = !newTasks[index].done
    setTasks(newTasks)
  }

  const doneCount = tasks.filter(t => t.done).length

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>✅ Task Tracker</h1>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)} 
        placeholder="Write a task..." 
      />
      <button onClick={addTask}>Add</button>
      
      <ul style={{ listStyle: 'none', marginTop: '20px' }}>
        {tasks.map((t, i) => (
          <li key={i} onClick={() => toggleTask(i)} 
              style={{ textDecoration: t.done ? 'line-through' : 'none', cursor: 'pointer' }}>
            {t.text}
          </li>
        ))}
      </ul>

      <h3>Progress: {doneCount} / {tasks.length}</h3>
    </div>
  )
}

export default App