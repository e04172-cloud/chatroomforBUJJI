import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StudentApp } from './student/StudentApp';
import { TeacherApp } from './teacher/TeacherApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/teacher/*" element={<TeacherApp />} />
        <Route path="/*" element={<StudentApp />} />
      </Routes>
    </BrowserRouter>
  );
}
