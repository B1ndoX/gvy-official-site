import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import {initialHostMembers} from './bridge';
const initial=await initialHostMembers();
createRoot(document.getElementById('root')!).render(<App initialMembers={initial?.members} firstLoad={initial?.firstLoad}/>);
