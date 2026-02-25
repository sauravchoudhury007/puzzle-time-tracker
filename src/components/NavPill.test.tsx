import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NavPill from './NavPill'

describe('NavPill', () => {
  it('opens the menu on hover and keeps it open when moving into the menu', async () => {
    const user = userEvent.setup()
    render(<NavPill currentHref="/tracker" />)
    const button = screen.getByRole('button', { name: /tracker/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    // menu closed initially
    expect(dropdown).toHaveClass('pointer-events-none')

    await act(async () => {
      await user.hover(button)
    })

    await waitFor(() => {
      expect(dropdown).toHaveClass('pointer-events-auto')
    })

    // move cursor into the dropdown and ensure it stays open
    await act(async () => {
      await user.hover(dropdown)
    })

    await waitFor(() => {
      expect(dropdown).toHaveClass('pointer-events-auto')
    })
  })

  it('toggles open/close on click', async () => {
    render(<NavPill currentHref="/dashboard" />)
    const button = screen.getByRole('button', { name: /dashboard/i })
    const dropdown = screen.getByTestId('navpill-dropdown')

    // Initial state
    expect(dropdown).toHaveClass('pointer-events-none')

    // Open
    await act(async () => {
      button.click()
    })
    expect(dropdown).toHaveClass('pointer-events-auto')

    // Close
    await act(async () => {
      button.click()
    })
    expect(dropdown).toHaveClass('pointer-events-none')
  })
})
