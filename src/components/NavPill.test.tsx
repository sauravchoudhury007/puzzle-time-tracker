import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import NavPill from './NavPill'

describe('NavPill', () => {
  it('opens the menu on hover and keeps it open when moving into the menu', async () => {
    render(<NavPill currentHref="/tracker" />)
    const button = screen.getByRole('button', { name: /tracker/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    // menu closed initially
    expect(dropdown).toHaveClass('pointer-events-none')

    await userEvent.hover(button)
    expect(dropdown).toHaveClass('pointer-events-auto')

    // move cursor into the dropdown and ensure it stays open
    await userEvent.hover(dropdown)
    expect(dropdown).toHaveClass('pointer-events-auto')
  })

  it('toggles open/close on click', async () => {
    render(<NavPill currentHref="/dashboard" />)
    const button = screen.getByRole('button', { name: /dashboard/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    await userEvent.click(button)
    expect(dropdown).toHaveClass('pointer-events-auto')

    await userEvent.click(button)
    expect(dropdown).toHaveClass('pointer-events-none')
  })

  it('does not close while moving from button to dropdown, but closes shortly after leaving', async () => {
    vi.useFakeTimers()
    render(<NavPill currentHref="/dashboard" />)
    const button = screen.getByRole('button', { name: /dashboard/i })
    const dropdown = screen.getByTestId('navpill-dropdown')
    const wrapper = screen.getByTestId('navpill')

    await userEvent.hover(button)
    expect(dropdown).toHaveClass('pointer-events-auto')

    // move away from button then into dropdown before timeout hits
    await userEvent.unhover(button)
    await userEvent.hover(dropdown)
    vi.advanceTimersByTime(200)
    expect(dropdown).toHaveClass('pointer-events-auto')

    // leaving the whole region eventually closes it
    await userEvent.unhover(dropdown)
    await userEvent.unhover(wrapper)
    vi.advanceTimersByTime(200)
    expect(dropdown).toHaveClass('pointer-events-none')

    vi.useRealTimers()
  })
})
