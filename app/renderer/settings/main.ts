import { mount } from 'svelte'
import App from './App.svelte'
import './api'

mount(App, { target: document.getElementById('app')! })
