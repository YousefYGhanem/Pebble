import { mount } from 'svelte'
import App from './App.svelte'
import './api'
import '../tokens.css'

mount(App, { target: document.getElementById('app')! })
